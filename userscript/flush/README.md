flush

youtube player userscript | seek | miniplayer | gestures | cpu tamer | hidden page clutter

features
hide elements | uBlock youtube filters as css | 22 selectors in HIDE
cpu tamer | timer callbacks on animation frames | applies on reload
seek buttons | , and . keys | 1-60s step
miniplayer button | i key
gestures | wheel on player edges | brightness left 30% | volume right 30% | 200%

settings
sliders button in player controls | tampermonkey menu settings
on/off per feature | seek step | gesture step 1-20% | applies live | cpu tamer on reload
all on by default | kept in tampermonkey storage

gotchas
hide selectors are youtube's generated class names | a deploy renames them | stale ones just stop hiding
cpu tamer patches the page window | needs `unsafeWindow` grant
not in embedded players | @noframes
no innerHTML | youtube enforces trusted types

selftest node selftest.js

github http://github.com/SolRaze/extentions/tree/main/userscript/flush | greasyfork https://greasyfork.org/en/scripts/598191-flush

license mit
