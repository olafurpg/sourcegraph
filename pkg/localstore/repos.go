package localstore

import (
	"bytes"
	"log"
	"regexp"
	"strings"
	"time"
	"unicode"

	"context"

	"github.com/keegancsmith/sqlf"
	"github.com/lib/pq"
	sourcegraph "sourcegraph.com/sourcegraph/sourcegraph/pkg/api"
	"sourcegraph.com/sourcegraph/sourcegraph/pkg/conf/feature"
	"sourcegraph.com/sourcegraph/sourcegraph/pkg/env"
	"sourcegraph.com/sourcegraph/sourcegraph/pkg/github"
)

var autoRepoWhitelist []*regexp.Regexp

func init() {
	for _, pattern := range strings.Fields(env.Get("AUTO_REPO_WHITELIST", ".+", "whitelist of repositories that will be automatically added to the DB when opened (space-separated list of lower-case regular expressions)")) {
		expr, err := regexp.Compile("^" + pattern + "$")
		if err != nil {
			log.Fatalf("invalid regular expression %q in AUTO_REPO_WHITELIST: %s", pattern, err)
		}
		autoRepoWhitelist = append(autoRepoWhitelist, expr)
	}
}

// repos is a DB-backed implementation of the Repos
type repos struct{}

// Get returns metadata for the request repository ID. It fetches data
// only from the database and NOT from any external sources. If the
// caller is concerned the copy of the data in the database might be
// stale, the caller is responsible for fetching data from any
// external services.
func (s *repos) Get(ctx context.Context, id int32) (*sourcegraph.Repo, error) {
	if Mocks.Repos.Get != nil {
		return Mocks.Repos.Get(ctx, id)
	}

	repos, err := s.getBySQL(ctx, sqlf.Sprintf("WHERE id=%d LIMIT 1", id))
	if err != nil {
		return nil, err
	}

	if len(repos) == 0 {
		return nil, ErrRepoNotFound
	}
	repo := repos[0]

	if !feature.Features.Sep20Auth {
		// 🚨 SECURITY: access control check here 🚨
		if repo.Private && !verifyUserHasRepoURIAccess(ctx, repo.URI) {
			return nil, ErrRepoNotFound
		}
	}
	return repo, nil
}

// GetByURI returns metadata for the request repository URI. See the
// documentation for repos.Get for the contract on the freshness of
// the data returned.
//
// If the repository doesn't already exist in the db, this method will
// add it to the db if the repo exists and start cloning, but will
// not wait for cloning to finish before returning.
//
// If the repository already exists in the db, that information is returned
// and no effort is made to detect if the repo is cloned or cloning.
func (s *repos) GetByURI(ctx context.Context, uri string) (*sourcegraph.Repo, error) {
	if Mocks.Repos.GetByURI != nil {
		return Mocks.Repos.GetByURI(ctx, uri)
	}

	repo, err := s.getByURI(ctx, uri)
	if err != nil {
		whitelisted := false
		for _, expr := range autoRepoWhitelist {
			if expr.MatchString(strings.ToLower(uri)) {
				whitelisted = true
				break
			}
		}
		if !whitelisted {
			return nil, err
		}

		if strings.HasPrefix(strings.ToLower(uri), "github.com/") {
			// Repo does not exist in DB, create new entry.
			ctx = context.WithValue(ctx, github.GitHubTrackingContextKey, "Repos.GetByURI")
			ghRepo, err := github.GetRepo(ctx, uri)
			if err != nil {
				return nil, err
			}
			if ghRepo.URI != uri {
				// not canonical name (the GitHub api will redirect from the old name to
				// the results for the new name if the repo got renamed on GitHub)
				if repo, err := s.getByURI(ctx, ghRepo.URI); err == nil {
					return repo, nil
				}
			}

			if err := s.TryInsertNew(ctx, ghRepo.URI, ghRepo.Description, ghRepo.Fork, ghRepo.Private); err != nil {
				return nil, err
			}

			return s.getByURI(ctx, ghRepo.URI)
		}

		return nil, err
	}

	return repo, nil
}

func (s *repos) getByURI(ctx context.Context, uri string) (*sourcegraph.Repo, error) {
	repos, err := s.getBySQL(ctx, sqlf.Sprintf("WHERE uri=%s LIMIT 1", uri))
	if err != nil {
		return nil, err
	}

	if len(repos) == 0 {
		return nil, ErrRepoNotFound
	}
	repo := repos[0]

	if !feature.Features.Sep20Auth {
		// 🚨 SECURITY: access control check here 🚨
		if repo.Private && !verifyUserHasRepoURIAccess(ctx, repo.URI) {
			return nil, ErrRepoNotFound
		}
	}

	return repo, nil
}

func (s *repos) getBySQL(ctx context.Context, querySuffix *sqlf.Query) ([]*sourcegraph.Repo, error) {
	q := sqlf.Sprintf("SELECT id, uri, description, homepage_url, default_branch, language, blocked, fork, private, indexed_revision, created_at, updated_at, pushed_at, freeze_indexed_revision FROM repo %s", querySuffix)
	rows, err := globalDB.Query(q.Query(sqlf.PostgresBindVar), q.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var repos []*sourcegraph.Repo
	for rows.Next() {
		var repo sourcegraph.Repo
		var freezeIndexedRevision *bool

		if err := rows.Scan(
			&repo.ID,
			&repo.URI,
			&repo.Description,
			&repo.HomepageURL,
			&repo.DefaultBranch,
			&repo.Language,
			&repo.Blocked,
			&repo.Fork,
			&repo.Private,
			&repo.IndexedRevision,
			&repo.CreatedAt,
			&repo.UpdatedAt,
			&repo.PushedAt,
			&freezeIndexedRevision,
		); err != nil {
			return nil, err
		}

		repo.FreezeIndexedRevision = freezeIndexedRevision != nil && *freezeIndexedRevision // FIXME: bad DB schema: nullable boolean

		repos = append(repos, &repo)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	return repos, nil
}

type RepoListOp struct {
	// Query specifies a search query for repositories. If specified, then the Sort and
	// Direction options are ignored
	Query string
	sourcegraph.ListOptions
}

// makeFuzzyLikeRepoQuery turns a string of "foo/bar" into "%foo%/%bar%".
// Anything that is not a letter or digit is turned turned surrounded by %.
// Except for space, which is just turned into %.
func makeFuzzyLikeRepoQuery(q string) string {
	var last rune
	var b bytes.Buffer
	b.Grow(len(q) + 4) // most queries will add around 4 wildcards (prefix, postfix and around separator)
	writeRune := func(r rune) {
		if r == '%' && last == '%' {
			return
		}
		last = r
		b.WriteRune(r)
	}
	writeEscaped := func(r rune) {
		if last != '%' {
			b.WriteRune('%')
		}
		b.WriteRune('\\')
		b.WriteRune(r)
		b.WriteRune('%')
		last = '%'
	}

	writeRune('%') // prefix
	for _, r := range q {
		switch r {
		case ' ':
			// Ignore space, since repo URI can't contain it. Just add a wildcard
			writeRune('%')
		case '\\':
			writeEscaped(r)
		case '%':
			writeEscaped(r)
		case '_':
			writeEscaped(r)
		default:
			if unicode.IsLetter(r) || unicode.IsDigit(r) {
				writeRune(r)
			} else {
				writeRune('%')
				writeRune(r)
				writeRune('%')
			}
		}
	}
	writeRune('%') // postfix

	return b.String()
}

// List lists repositories in the Sourcegraph repository
//
// This will not return any repositories from external services that are not present in the Sourcegraph repository.
// The result list is unsorted and has a fixed maximum limit of 1000 items.
// Matching is done with fuzzy matching, i.e. "query" will match any repo URI that matches the regexp `q.*u.*e.*r.*y`
func (s *repos) List(ctx context.Context, opt *RepoListOp) ([]*sourcegraph.Repo, error) {
	if Mocks.Repos.List != nil {
		return Mocks.Repos.List(ctx, opt)
	}

	if opt == nil {
		opt = &RepoListOp{}
	}

	conds := []*sqlf.Query{sqlf.Sprintf("TRUE")}
	if opt.Query != "" {
		conds = append(conds, sqlf.Sprintf("lower(uri) LIKE %s", makeFuzzyLikeRepoQuery(strings.ToLower(opt.Query))))
	}

	// fetch matching repos unordered
	rawRepos, err := s.getBySQL(ctx, sqlf.Sprintf("WHERE %s LIMIT 1000", sqlf.Join(conds, "AND")))

	if err != nil {
		return nil, err
	}

	var repos []*sourcegraph.Repo
	if !feature.Features.Sep20Auth {
		// 🚨 SECURITY: It is very important that the input list of repos (rawRepos) 🚨
		// comes directly from the DB as verifyUserHasReadAccessAll relies directly
		// on the accuracy of the Repo.Private field.
		repos, err = verifyUserHasReadAccessAll(ctx, "Repos.List", rawRepos)
		if err != nil {
			return nil, err
		}
	} else {
		repos = rawRepos
	}

	// pagination
	if opt.Page > 0 {
		start := (opt.Page - 1) * opt.PerPage
		if int(start) >= len(repos) {
			return nil, nil
		}
		repos = repos[start:]
		if len(repos) > int(opt.PerPage) {
			repos = repos[:opt.PerPage]
		}
	}

	return repos, nil
}

// UpdateRepoFieldsFromRemote updates the DB from the remote (e.g., GitHub).
func (s *repos) UpdateRepoFieldsFromRemote(ctx context.Context, repoID int32) error {
	repo, err := s.Get(ctx, repoID)
	if err != nil {
		return err
	}

	if strings.HasPrefix(strings.ToLower(repo.URI), "github.com/") {
		return s.updateRepoFieldsFromGitHub(ctx, repo)
	}
	return nil
}

func (s *repos) updateRepoFieldsFromGitHub(ctx context.Context, repo *sourcegraph.Repo) error {
	// Fetch latest metadata from GitHub
	ghrepo, err := github.GetRepo(ctx, repo.URI)
	if err != nil {
		return err
	}

	var updates []*sqlf.Query
	if ghrepo.Description != repo.Description {
		updates = append(updates, sqlf.Sprintf("description=%s", ghrepo.Description))
	}
	if ghrepo.HomepageURL != repo.HomepageURL {
		updates = append(updates, sqlf.Sprintf("homepage_url=%s", ghrepo.HomepageURL))
	}
	if ghrepo.DefaultBranch != repo.DefaultBranch {
		updates = append(updates, sqlf.Sprintf("default_branch=%s", ghrepo.DefaultBranch))
	}
	if ghrepo.Private != repo.Private {
		updates = append(updates, sqlf.Sprintf("private=%v", ghrepo.Private))
	}

	if !timestampEqual(repo.UpdatedAt, ghrepo.UpdatedAt) {
		updates = append(updates, sqlf.Sprintf("updated_at=%s", ghrepo.UpdatedAt))
	}
	if !timestampEqual(repo.PushedAt, ghrepo.PushedAt) {
		updates = append(updates, sqlf.Sprintf("pushed_at=%s", ghrepo.PushedAt))
	}

	if len(updates) > 0 {
		q := sqlf.Sprintf("UPDATE repo SET %s WHERE id=%d", sqlf.Join(updates, ","), repo.ID)
		if _, err := globalDB.Exec(q.Query(sqlf.PostgresBindVar), q.Args()...); err != nil {
			return err
		}
	}

	return nil
}

func (s *repos) UpdateLanguage(ctx context.Context, repoID int32, language string) error {
	_, err := globalDB.Exec("UPDATE repo SET language=$1 WHERE id=$2", language, repoID)
	return err
}

func (s *repos) UpdateIndexedRevision(ctx context.Context, repoID int32, rev string) error {
	_, err := globalDB.Exec("UPDATE repo SET indexed_revision=$1 WHERE id=$2", rev, repoID)
	return err
}

// TryInsertNew attempts to insert the repository rp into the db. It returns no error if a repo
// with the given uri already exists.
func (s *repos) TryInsertNew(ctx context.Context, uri string, description string, fork bool, private bool) error {
	_, err := globalDB.Exec("INSERT INTO repo (uri, description, fork, private, created_at, vcs, default_branch, homepage_url, language, blocked) VALUES ($1, $2, $3, $4, $5, '', '', '', '', false)", uri, description, fork, private, time.Now()) // FIXME: bad DB schema: nullable columns
	if err != nil {
		if isPQErrorUniqueViolation(err) {
			if c := err.(*pq.Error).Constraint; c == "repo_uri_unique" {
				return nil // repo with given uri already exists
			}
		}
		return err
	}
	return nil
}

func timestampEqual(a, b *time.Time) bool {
	if a == b {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return a.Equal(*b)
}
