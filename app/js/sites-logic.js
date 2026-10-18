// Rules for the site list, without storage, so they run in tests.

// The site with the same repository and branch, or undefined. GitHub ignores case in owner and repository names.
export function findDuplicate(sites, { owner, repo, branch }) {
    const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
    return sites.find(site => same(site.owner, owner) && same(site.repo, repo) && site.branch === branch);
}

// The name in the app when the user does not type one: the repository name.
export function defaultName(parsed) {
    return parsed ? parsed.repo : '';
}
