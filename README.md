First, [create a Jira API
token](https://id.atlassian.com/manage/api-tokens). Then update the info
in `config.json` (it needs to use the token for the `authPass` value;
`authUser` is your account email that you use to authenticate on Jira
hosted at the `apiHost`.

In the example below `previous-production-build` and
`current-production-build` are git tags (you may as well use commit
hashes or branch names). The `grep` filters out only Jira IDs from
git logs (e.g. PROJ-001, YAPK-1234). The last bit is a call to execute
`jira-issue-parser/index.js` using `node`. This can be symlinked,
aliased or used as is -- it's up to you.
```
git log --pretty="format:%s%n%b" previous-production-build..current-production-build | grep --only-matching --extended-regexp '[A-Z]+-[0-9]+' | sort --unique | node path/to/jira-issue-parser.js
```

Here's an alias example (in your `.profile` [`.bash_profile`])):

```
alias jira-issue-parser="node ~/path/to/jira-issue-parser/index.js"

function get-jira-issues() {
  if [ -n "$1" ]
  then
    git log --pretty="format:%s%n%b" $1 | grep --only-matching --extended-regexp "[A-Z]+-[0-9]+" | sort --unique | jira-issue-parser
  else
    echo "Arguments compatible with `git-log` needed"
  fi
}
```

This would prevent your tab-completion from working; to fix that (in
`zsh`):
```
autoload -Uz compinit
compinit

compdef _git get-jira-issues=git-log
```

The code above would allow you to use the func as:

```
get-jira-issues previous-production-build..current-production-build
```
