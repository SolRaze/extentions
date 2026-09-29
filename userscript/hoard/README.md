hoard

instagram saved library | sorter | downloader | read-only, never writes to the account

usage
hoard pill bottom-left | or tampermonkey menu open hoard | esc closes
refresh pulls saved feed + collections with tab session | cached until next refresh
full-screen library covers the rest of instagram
filter collection | no collection | type | user or caption
sort saved | newest | oldest | user | likes
tile opens viewer | full media | caption | collections | single download

download
download shown saves filtered list | `instagram/<collection>/<user>_<code>[_n].<ext>`
folder is viewed collection | else first collection | else saved
done posts marked ✓ and skipped | viewer download forces
tampermonkey download mode browser api | subfolders need it
cdn urls expire after days | failures mean refresh

gotchas
throttled 1.5 s per feed page | 0.8 s per downloaded post | fast scraping risks account flag
media id stays a string | pk overflows a js number

selftest node selftest.js

github http://github.com/SolRaze/extentions/tree/main/userscript/hoard | greasyfork https://greasyfork.org/en/scripts/598006-hoard

license mit
