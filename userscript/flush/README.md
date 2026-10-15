flush

youtube player userscript | seek | miniplayer | gestures | sponsorblock | cpu tamer | hidden page clutter | cookies for yt-dlp | playlists tagged in mark

features
hide elements | uBlock youtube filters as css | 22 selectors in HIDE
cpu tamer | timer callbacks on animation frames | applies on reload
seek buttons | , and . keys | 1-60s step
miniplayer button | i key
gestures | wheel on player edges | brightness left 30% | volume right 30% | 200%
sponsorblock | auto skip per category | once per segment | no player buttons | seek bar markers optional, off by default

cookies | private tab only | get cookies in settings | youtube.com cookies as Downloads/youtube-cookies.txt | `yt-dlp --cookies`

playlists
playlists in the flush panel | or tampermonkey menu playlists | full-tab overlay | esc or ✕ closes
refresh | every playlist of the account, watch later, liked videos | tab session | 1 s per page | read-only
library | filter playlist | search title or channel | playlists grey, mark tags blue | ⊘ unavailable | first 500 rows
mark | playlist title = tag on the video | sent on refresh, new pairs only | watch later and unavailable videos never tagged
mark | a tag removed in mark stays removed | becomes a removal in the plan
plan | nothing written | removes unavailable, extra copies, videos untagged in mark | adds videos tagged with a playlist's title
plan | tag removals only while the tag still exists in mark | liked videos never edited
apply | confirm, then edits the account | 50 per request | a playlist refusing an edit is skipped from then on | refreshes after
new playlist | create it on youtube under the tag's name | next refresh links it
export | Downloads/flush-playlists.json | library + mark tags
store | tampermonkey storage flush.library | flush.sent pairs mark has been sent

settings
flush pill bottom right, above mark's | or tampermonkey menu settings, the way in from fullscreen | esc, ✕ or click outside closes
update | checks greasyfork when the panel opens, label shows the new version | click opens tampermonkey's install page | reload after
on/off per feature | sponsorblock categories and markers | seek step | gesture step 1-20% | applies live | cpu tamer on reload
all on by default | sponsorblock: sponsor, self promotion, subscribe reminder | kept in tampermonkey storage

gotchas
hide selectors are youtube's generated class names | a deploy renames them | stale ones just stop hiding
cpu tamer patches the page window | needs `unsafeWindow` grant
not in embedded players | @noframes
no innerHTML | youtube enforces trusted types
button icons 24px like the player's own | 36 grid cropped by viewBox
cookies | sign in inside the private window, get cookies, close the window | a session the browser keeps using gets its cookies rotated, the file dies
cookies | tampermonkey needs allow in incognito | browser extension settings
youtube-cookies.txt is the signed-in session | whoever reads it is the account
playlists read by shape | video and playlist lockups, first continuation token | a redesign renaming lockupViewModel empties the library
duplicate removal needs setVideoId | only an owner's view carries it | without it extra copies stay
renamed playlist | old tag stays in mark | rename the tag in mark too
unavailable detected by title | english ui only
sponsorblock lookup sends 4 hex chars of sha256(video id) | sponsor.ajay.app | `@connect` grant

selftest node selftest.js

github http://github.com/SolRaze/extentions/tree/main/userscript/flush | greasyfork https://greasyfork.org/en/scripts/598191-flush

license mit
