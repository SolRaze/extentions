pace

one pace player userscript | onepace.net watch page as one list and player | intro, outro skip | autonext | watched marks
pixeldrain list player | side bars hidden | opening skip

onepace.net/en/watch
page hidden behind the player | tab title one piece, held against the router | settings show the page | pace pill on the page brings the player back, none in the player
header | ☰ far left hides the list | watched of all episodes | up next, click plays it | pace far right opens settings
list | arcs only, watched count right of each arc | one arc open at a time | playing arc opens at the top, white bar | ✓ right of a watched episode, click or right-click toggles, hover shows it on the rest | rows are buttons, tab reaches them
player | streams the episode's pixeldrain file | picture at full 16:9 height | title and description below it, the column scrolls
status | spinner after 0.4 s of buffering | a file that fails shows a message and retry
controls | own seek bar | one row: time left | prev, -10s, play, +10s, next centred, tooltips name the episode | volume slider to 200%, mute, pip, fullscreen, download right | under the video, overlaid only in fullscreen, hide there after 1.5 s idle | click plays, double-click fullscreen
seek bar | handle and time bubble on hover | lighter stretch is buffered | shaded skip zones | white ticks chapter starts | green ticks marked zone bounds | a click or drag into a zone plays it | focus it with tab, arrows move 5 s
skip intro | button over the video when auto skip did not take it, zone with skip off or replayed | fades with idle
+90s | same button when no intro is known | first 90 s only, gone once used
resume | each episode reopens where it stopped | dropped once watched
info | episode number and title | description
gestures | wheel over left 30% brightness | right 30% volume to 200% | readout over the video
focus | a mouse click leaves no ring | keyboard focus shows a white outline
settings | pace top right | variant, resolution, cuts, skip, autonext, marks | esc or click outside closes
update | settings button | checks greasyfork meta | installs through tampermonkey | pace shows • when newer
variant | english subtitles, dub, dub with closed captions | alternate cuts toggle picks extended or g-8 cut where one exists
resolution | 1080p, 720p, 480p | nearest carried one when missing
skip | opening, ending, credits, preview chapters | once per file | seek back replays
marks | mark intro start, intro end, outro start at the current time | files without chapters only | clear marks drops the episode's and the arc's
marks | intro kept as a length, start 0 unless marked | length and outro of the latest mark are the arc default for unmarked episodes | intro start is per episode, for a cold open before the opening
marks | marking never jumps the playing file | clear marks takes a second click within 3 s
autonext | on outro mark, skipped last chapter or end | toggle
watched | past 90% or finished | first unwatched opens, or the last played
export, import | settings | watched, marks, resume as pace.json | import merges
narrow | under 800 px the list overlays and starts closed | picking an episode closes it
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
