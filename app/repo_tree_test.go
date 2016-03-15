package app_test

import (
	"io/ioutil"
	"strings"
	"testing"

	"sourcegraph.com/sourcegraph/sourcegraph/app/internal/apptest"
	"sourcegraph.com/sourcegraph/sourcegraph/app/router"
	"sourcegraph.com/sourcegraph/sourcegraph/go-sourcegraph/sourcegraph"
)

func TestRepoTree(t *testing.T) {
	c, mock := apptest.New()
	const source = "test.go"
	const expectedHTML = source

	mockRepoGet(mock, "my/repo")
	mockEmptyRepoConfig(mock)
	mock.Repos.MockGetCommit_ByID_NoCheck(t, "c")
	mockNoSrclibData(mock)
	calledRepoTreeGet := mockTreeEntryGet(mock, &sourcegraph.TreeEntry{
		BasicTreeEntry: &sourcegraph.BasicTreeEntry{
			Contents: []byte(source),
		},
	})
	mock.Annotations.MockList(t, &sourcegraph.Annotation{})

	resp, err := c.GetOK(router.Rel.URLToRepoTreeEntry("my/repo", "some/branch", "test.go").String())
	if err != nil {
		t.Fatal(err)
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	contents := string(body)
	if !strings.Contains(contents, expectedHTML) {
		t.Errorf("Expected reponse body to contain '%s': %s", expectedHTML, contents)
	}
	if !*calledRepoTreeGet {
		t.Error("!calledRepoTreeGet")
	}
}

func TestRepoTree_markdown(t *testing.T) {
	c, mock := apptest.New()
	const docSource = "#Milton"
	const expectedHTML = "<h1>Milton</h1>"

	mockRepoGet(mock, "my/repo")
	mockEmptyRepoConfig(mock)
	mock.Repos.MockGetCommit_ByID_NoCheck(t, "c")
	mockNoSrclibData(mock)
	mockTreeEntryGet(mock, &sourcegraph.TreeEntry{
		BasicTreeEntry: &sourcegraph.BasicTreeEntry{
			Contents: []byte(docSource),
		},
	})
	mock.Annotations.MockList(t, &sourcegraph.Annotation{})

	resp, err := c.GetOK(router.Rel.URLToRepoTreeEntry("my/repo", "some/branch", "test.md").String())
	if err != nil {
		t.Fatal(err)
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	contents := string(body)
	if !strings.Contains(contents, expectedHTML) {
		t.Errorf("Expected reponse body to contain '%s'", expectedHTML)
	}
}

func TestRepoTree_plaintext(t *testing.T) {
	c, mock := apptest.New()
	const source = "Milton Woof"
	const expectedHTML = source

	mockRepoGet(mock, "my/repo")
	mockEmptyRepoConfig(mock)
	mock.Repos.MockGetCommit_ByID_NoCheck(t, "c")
	mockNoSrclibData(mock)
	mockTreeEntryGet(mock, &sourcegraph.TreeEntry{
		BasicTreeEntry: &sourcegraph.BasicTreeEntry{
			Contents: []byte(source),
		},
	})
	mock.Annotations.MockList(t, &sourcegraph.Annotation{})

	resp, err := c.GetOK(router.Rel.URLToRepoTreeEntry("my/repo", "some/branch", "filename.txt").String())
	if err != nil {
		t.Fatal(err)
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	contents := string(body)
	if !strings.Contains(contents, expectedHTML) {
		t.Errorf("Expected reponse body to contain '%s': %s", expectedHTML, contents)
	}
}
