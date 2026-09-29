hoard

instagram saved library | sorter | downloader | collection organizer

usage
hoard pill bottom-left | or tampermonkey menu open hoard | esc closes
refresh pulls saved feed + collections with tab session | cached until next refresh
filter collection | no collection | type | user or caption
sort saved | newest | oldest | user | likes
tile opens viewer | full media | caption | collections | single download

download
download shown saves filtered list | `instagram/<collection>/<user>_<code>[_n].<ext>`
folder is viewed collection | else first collection | else saved
done posts marked ✓ and skipped | viewer download forces
tampermonkey download mode browser api | subfolders need it
cdn urls expire after days | failures mean refresh

organize
unsorted posts scored per collection | same author 3 per post | shared hashtag 1 per post | min 3
leftovers cluster into new collections | author first | then hashtag | min 3 posts | existing names skipped
everything checked by default | new names editable | apply checked writes to instagram

gotchas
write endpoints untested | `media/<id>/save/` added_collection_ids | `collections/create/` added_media_ids
throttled 1.5 s per page | 2.5 s per write | fast scraping risks account flag
media id stays a string | pk overflows a js number

selftest node selftest.js

license mit
