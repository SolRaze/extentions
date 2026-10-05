pace

one pace player userscript | onepace.net watch page as one list and player | intro, outro skip | autonext | watched marks
pixeldrain list player | side bars hidden | opening skip

onepace.net/en/watch
page hidden behind the player | tab title one piece | settings show the page | pace pill brings the player back
list | arcs only, watched count per arc | one arc open at a time | current arc opens | ✓ watched | ☰ hides it
player | streams the episode's pixeldrain file | title on top | prev, -10s, +10s, next and description under it
settings | ⚙ pill top right | variant, resolution, cuts, skip, autonext, marks | esc or click outside closes
variant | english subtitles, dub, dub with closed captions | alternate cuts toggle picks extended or g-8 cut where one exists
resolution | 1080p, 720p, 480p | nearest carried one when missing
skip | opening, ending, credits, preview chapters | once per file | seek back replays
marks | mark intro end, mark outro start | per arc | files without chapters only | clear marks
autonext | on outro mark, skipped last chapter or end | toggle
watched | past 90% or finished | first unwatched opens, or the last played
keys | , back 10s | . forward 10s | n next | p previous
all choices kept in tampermonkey storage

pixeldrain.net/l/ | /u/
toolbar, share bar, banner hidden | player full width | small episode strip
chapter skip as above | play on every new file | pixeldrain advances on end itself

gotchas
episodes, titles, file ids scraped from the watch page | no list api calls | a page redesign breaks the scrape
links without a resolution are all-in-one files | skipped
chapters from the mp4 `chpl` box | last 16 KB of the file | info call for the size, then a range request
suffix range `bytes=-N` triggers a cors preflight pixeldrain fails | explicit start-end range only
most files carry no chapters | newer releases carry an opening chapter | none carry an ending
pixeldrain next is the player's skip_next button | a redesign renames it, autoplay still native

selftest node selftest.js
