flush

youtube player userscript | seek | miniplayer | gestures | cpu tamer | hidden page clutter

features
hide elements | uBlock youtube filters as css | 22 selectors in HIDE
cpu tamer | timer callbacks on animation frames | applies on reload
seek buttons | , and . keys | 1-60s step | fixed 10s
miniplayer button | i key
gestures | brightness left | volume right | 200%

settings
tampermonkey menu | on/off per feature | seek step | gesture sensitivity 1-20%
all on by default | kept in tampermonkey storage

gotchas
hide selectors are youtube's generated class names | a deploy renames them | stale ones just stop hiding
cpu tamer patches the page window | needs `unsafeWindow` grant
not in embedded players | @noframes

selftest node selftest.js

github http://github.com/SolRaze/extentions/tree/main/userscript/flush | greasyfork https://greasyfork.org/en/scripts/598191-flush

license mit
