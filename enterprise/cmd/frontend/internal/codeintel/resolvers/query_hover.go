package resolvers

import (
	"context"
	"time"

	"github.com/inconshreveable/log15"
	"github.com/opentracing/opentracing-go/log"
	"github.com/pkg/errors"

	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/stores/lsifstore"
	"github.com/sourcegraph/sourcegraph/internal/observation"
)

const slowHoverRequestThreshold = time.Second

// Hover returns the hover text and range for the symbol at the given position.
func (r *queryResolver) Hover(ctx context.Context, line, character int) (_ string, _ lsifstore.Range, _ bool, err error) {
	log15.Info("HELLO FROM HOVER")
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

	orderedMonikers, err := r.orderedMonikers(ctx, adjustedUploads, "import")
	if err != nil {
		return "", lsifstore.Range{}, false, errors.Wrap(err, "lsifStore.Hover")
	}

	uploads, err := r.definitionUploads(ctx, orderedMonikers)
	if err != nil {
		return "", lsifstore.Range{}, false, errors.Wrap(err, "lsifStore.Hover")
	}

	locations, _, err := r.monikerLocations(ctx, uploads, orderedMonikers, "definitions", DefinitionsLimit, 0)
	if err != nil {
		return "", lsifstore.Range{}, false, errors.Wrap(err, "lsifStore.Hover")
	}
	traceLog(log.Int("numLocations", len(locations)))

	return "", lsifstore.Range{}, false, nil
}
