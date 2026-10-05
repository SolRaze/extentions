pace

one pace player userscript | onepace.net watch page as one list and player | intro, outro skip | autonext | watched marks
pixeldrain list player | side bars hidden | opening skip

onepace.net/en/watch
page hidden behind the player | tab title one piece, held against the router | settings show the page | pace pill brings the player back
header | one piece left | bare ☰ hides the list | up next, click plays it | watched of all episodes, white line under the header | pace far right
list | arcs only, watched count per arc | one arc open at a time | playing arc opens at the top, white bar | ✓ watched | right-click toggles watched
player | streams the episode's pixeldrain file | prev, -10s, +10s, next centred under it | download far right
controls | own seek bar, play, time, mute, pip, fullscreen | under the video, overlaid only in fullscreen, hide there after 2.5 s idle | click plays, double-click fullscreen
seek bar | shaded skip ranges | white ticks chapter starts | green ticks the arc's marks
skip intro | button over the video when auto skip did not take it | chapter or mark with skip off | unknown intro jumps 90 s, first 3 min only
resume | each episode reopens where it stopped | dropped once watched
info | arc | episode number and title | description
gestures | wheel over left 30% brightness | right 30% volume to 200% | readout over the video
focus | buttons never take focus | no ring on the player after a seek
settings | pace pill top right | variant, resolution, cuts, skip, autonext, marks | esc or click outside closes
update | settings button | checks greasyfork meta | installs through tampermonkey | pill shows • when newer
variant | english subtitles, dub, dub with closed captions | alternate cuts toggle picks extended or g-8 cut where one exists
resolution | 1080p, 720p, 480p | nearest carried one when missing
skip | opening, ending, credits, preview chapters | once per file | seek back replays
marks | mark intro end, mark outro start | per episode, latest also the arc default for unmarked episodes | files without chapters only | clear marks drops both
autonext | on outro mark, skipped last chapter or end | toggle
watched | past 90% or finished | first unwatched opens, or the last played
export, import | settings | watched, marks, resume as pace.json | import merges
keys | , back 10s | . forward 10s | n next | p previous | k or space play | f fullscreen | m mute
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
volume past 100% routes through web audio | needs the video loaded with crossorigin, pixeldrain sends cors *
pixeldrain next is the player's skip_next button | a redesign renames it, autoplay still native

selftest node selftest.js
