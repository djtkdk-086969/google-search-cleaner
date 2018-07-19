Google掃除機(仮称) Google Search Cleaner
========================================

A user script for Greasemonkey / Tampermonkey which blocks unwanted websites on Google Search, by customizable rules.

## Summary

[日本語版のREADME.mdはこちら](README.md)

Google Search Cleaner (Tentative Name) is a user script for Greasemonkey / Tampermonkey which blocks unwanted websites on the results of Google Search. It currently supports Web Search Results and Image Search Results.

[![Demonstration](https://github.com/djtkdk-086969/google-search-cleaner/wiki/img/demo.thumb.png)](https://github.com/djtkdk-086969/google-search-cleaner/wiki/img/demo.png)

[Introduction Movie (Nico Nico Douga)](http://ext.nicovideo.jp/thumb_watch/sm29461061?thumb_mode=html)
(Please note that this movie was based on Ver. 1.1.1.086, an older version, and therefore some of its behavior are subject to change.)

## Features
This script has following functions:
* Customizable criteria for filtering search results
* Customizable actions other than hiding results (e.g. show warnings)
* Create and manage multiple sets of rules (rulesets) consisting of criteria and actions for the matched results
* Make a rule from a search results entry (Web Search only)
* Help search verbatim when some keywords are ignored (Missing: ~~Ignored Keywords~~)
* Hide "Did you mean:" on the second (or deeper) pages
* Apply search keyword exclusion ("minus" search) on related searches and autocomplete (search keyword suggestion)

You can hide search results based on URL forward matching or a regular expression, as well as host names.

## System Requirements
* Mozilla Firefox (Version 46+)
* Tampermonkey (Latest)

or

* Google Chrome (Latest)
* Tampermonkey (Latest)

Google Chrome is supported starting at Ver. 1.1.0.078.

## License
[GPL v3](http://www.gnu.org/copyleft/gpl.html)

## Author
[たかだか。(TakaDaka.)](https://twitter.com/djtkdk_086969)
