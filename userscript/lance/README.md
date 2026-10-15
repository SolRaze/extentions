lance

chat exporter with injection | usage tracker | enter-as-newline
supports claude | deepseek | brave/ask

features
export markdown | json | csv | txt | html | file yyyymmdd_turns_title
claude usage tracker | session, weekly, opus bars over the input
first-prompt injection | prepend then selected prompt | claude and deepseek | mouse or keyboard send | once per chat
saved prompts | add | select | enable | import and export as json, same title replaced
enter inserts newline in the chat input | cmd or ctrl+enter sends | both switchable
pill draggable | pin keeps it in place
update | in settings | checks greasyfork, opens tampermonkey's install page | reload after

gotchas
deepseek export reads replies through their copy buttons | clipboard restored after | needs clipboard permission
deepseek selectors are generated class names | a deploy renames them | export and injection there stop
no injection on brave/ask | chats start from the search box
trusted types | own policy lance | claude.ai enforces them

selftest node selftest.js

github http://github.com/SolRaze/extentions/tree/main/userscript/lance | greasyfork https://greasyfork.org/en/scripts/592831-lance

license mit
