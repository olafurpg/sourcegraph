package resolvers

import (
	"context"
	"time"

	"github.com/opentracing/opentracing-go/log"
	"github.com/pkg/errors"

	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/stores/lsifstore"
	"github.com/sourcegraph/sourcegraph/internal/observation"
)

const slowHoverRequestThreshold = time.Second

// Hover returns the hover text and range for the symbol at the given position.
func (r *queryResolver) Hover(ctx context.Context, line, character int) (_ string, _ lsifstore.Range, _ bool, err error) {
	ctx, traceLog, endObservation := observeResolver(ctx, &err, "Hover", r.operations.hover, slowHoverRequestThreshold, observation.Args{
		LogFields: []log.Field{
			log.Int("repositoryID", r.repositoryID),
			log.String("commit", r.commit),
			log.String("path", r.path),
			log.Int("numUploads", len(r.uploads)),
			log.String("uploads", uploadIDsToString(r.uploads)),
			log.Int("line", line),
			log.Int("character", character),
		},
	})
	defer endObservation()

	adjustedUploads, err := r.adjustUploads(ctx, line, character)
	if err != nil {
		return "", lsifstore.Range{}, false, err
	}

	for i := range adjustedUploads {
		adjustedUpload := adjustedUploads[i]
		traceLog(log.Int("uploadID", adjustedUpload.Upload.ID))

		// Fetch hover text from the index
		text, rn, exists, err := r.lsifStore.Hover(
			ctx,
			adjustedUpload.Upload.ID,
			adjustedUpload.AdjustedPathInBundle,
			adjustedUpload.AdjustedPosition.Line,
			adjustedUpload.AdjustedPosition.Character,
		)
		if err != nil {
			return "", lsifstore.Range{}, false, errors.Wrap(err, "lsifStore.Hover")
		}
		if !exists || text == "" {
			continue
		}

		// Adjust the highlighted range back to the appropriate range in the target commit
		_, adjustedRange, err := r.adjustRange(ctx, r.uploads[i].RepositoryID, r.uploads[i].Commit, r.path, rn)
		if err != nil {
			return "", lsifstore.Range{}, false, err
		}

		return text, adjustedRange, true, nil
	}

	locations, err := r.Definitions(ctx, line, character)

	for i := range locations {
		text, rn, exists, err := r.lsifStore.Hover(
			ctx,
			locations[i].Dump.ID,
			locations[i].Path,
			locations[i].AdjustedRange.Start.Line,
			locations[i].AdjustedRange.Start.Character,
		)
		if err != nil {
			return "", lsifstore.Range{}, false, errors.Wrap(err, "lsifStore.Hover")
		}
		if !exists || text == "" {
			continue
		}

		// Adjust the highlighted range back to the appropriate range in the target commit
		_, adjustedRange, err := r.adjustRange(ctx, r.uploads[i].RepositoryID, r.uploads[i].Commit, r.path, rn)
		if err != nil {
			return "", lsifstore.Range{}, false, err
		}

		return text, adjustedRange, true, nil
	}

	return "", lsifstore.Range{}, false, nil
}
