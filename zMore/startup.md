03-21 7-24-20 AM

AI instructions to read and follow.

Try to always do the suggestions below


## BASICS

always read this file first - startup.md

When I ask you to read startup.md, you should search case-insensitively anywhere in the repo. If there are multiple matches, ask me which one to use.

## zMore folder

always save markdown files in zMore folder
always use kebab case for file names
github Include whatever’s in zMore/ (including deletions).

github zMore - Never restore locally deleted files before committing.

## DESIGN

 Do not use fallbacks unless necessary and unless you ask me first. I would prefer when I give you field names from Filemaker that you use them exactly as I gave them and do not guess at other probabilities. If the fields are incorrect we will fix them as we go one at a time.

 Make the app always work in dark mode and light mode both.

 Read this @working-with-light-and-dark-mode.md 

 Always make the app Mobile friendly and desktop friendly

Always make the app navigation work for desktop and also have a hamburger style menu for mobile.

- logout page should always remove all session storage variables

## Filemaker database server

Filemaker data API authentication token management

The management of the Data API authentication tokens should happen on the server and they would work like this.

From the initial client login Page - it does a Filemaker look up on the server

At this point you would check to see if there is an active data API authentication token and use it

If there is either no token or if the token has expired then you would create a new token and use that instead  using .env credentials

From then on all of the Filemaker queries would use the session Data API token. If it has expired it would auto renew.


### GitHub

- Default branch to push: `main`.
- Agreed policy:
  - Commit whatever changes exist under `zMore/`.
  - If files are deleted locally, keep them deleted (do not restore before committing).

Do not suggest to run build until we are ready to deploy

Come up with your own commit message based on recent updates



## More suggestions soon.


GIT settings —use  repo-local git config:

user.name = revbiz
user.email = revbiz@musenet.com

git config --local user.name "revbiz"
git config --local user.email "revbiz@musenet.com"

git config --local --get user.name
git config --local --get user.email

On some other repo I may need to change this but this will work for many.
