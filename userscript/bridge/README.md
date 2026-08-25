bridge

opens thingiverse model files in orcaslicer at any window width

thingiverse mounts its "open in <slicer>" button group only above the 1024px tablet
breakpoint, so narrowing the window removes the button entirely — it is unmounted, not
hidden, which is why no css or zoom fix brings it back. bridge adds its own button next
to each file's download button and removes it again when thingiverse's own reappears.

covers stl | 3mf | obj — the same files thingiverse itself offers a slicer button for
link format orcaslicer://open?file=<url-encoded file url>

requires orcaslicer with a download folder set (configuration wizard), otherwise the
deep link opens the app and stops with a destination-folder error

selftest node selftest.js

github http://github.com/SolRaze/extentions/tree/main/userscript/bridge

license mit
