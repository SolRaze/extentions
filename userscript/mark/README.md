mark

tag users, posts, videos, communities and links | colours | notes | per-tag hide, dim or star | tags page
x | reddit | github | youtube | instagram | hacker news | soundcloud | pinterest | civitai

usage
hover a link | 🏷 button beside it | or press t
editor | applied tags on top | every known tag as a pill, sized by use | click toggles
typing filters the pills | enter adds typed tag, existing casing reused | tab picks first pill | ⌫ removes last | esc closes
note field per entry | shown as ✎ chip and chip tooltip
chips after every tagged link | click opens the editor | hover shows × | × removes that tag
menus and popups never carry chips
youtube | chips under clamped titles | the watch page title and channel header carry their own tags
off-site links tag as plain links | same-site links without a rule never

tags page
mark pill bottom right | alt+shift+t | or tampermonkey menu `mark` | full-tab overlay
tag cloud sized by use | click tags to filter | several tags = entries carrying all
one tag picked | rename | renaming onto an existing tag merges | colour slider | effect | delete tag
compact rows | type icon, title, chips | url and note on hover | edit | delete
bulk | row checkboxes | shift-click extends | select all shown | add tag | remove tag | delete
undo | one step back for rename, delete and bulk
tag this page | show hidden | export | import
update | checks greasyfork when the page opens, label shows the new version | click opens tampermonkey's install page | reload after

effects
set per tag on the tags page | label | star | dim | hide
default by name | star ★ | dim ignore clickbait promotion sb | hide block
star | yellow edge on the list entry
dim | entry at 35% until hover
hide | entry gone | show hidden brings it back faint
a post inherits effects from its user or community | reddit sub | github repo and owner | x user | soundcloud user

keys
user, community and repo keys lowercase | post and video ids keep case
youtube watch, shorts, youtu.be share one video key | twitter.com folds into x.com
civitai.red into civitai.com | regional pinterest into pinterest.com
tracking params dropped | utm_* fbclid gclid si igsh ref_src
tags from one site show on links to it from another | a github repo on hacker news

store
tampermonkey storage `mark.store` | utags shape | a utags export imports here
import | newer entry wins whole | removed tags and utags deletions carry over | undo reverts it
meta.colors tag to hue | meta.effects tag to effect | meta.note per entry
entries kept while they carry a tag or a note | open tabs sync on save

gotchas
text links only | avatars and thumbnails skipped | pinterest, civitai also take image links
x users tagged from @handle links only
item selectors are each site's markup | a redesign breaks effects there, chips keep working

selftest node selftest.js

github http://github.com/SolRaze/extentions/tree/main/userscript/mark | greasyfork https://greasyfork.org/en/scripts/598296-mark

license mit
