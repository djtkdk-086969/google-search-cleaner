Google掃除機(仮称) Google Search Cleaner
========================================

Googleの検索結果から特定のページを非表示にするGreasemonkey/Tampermonkey用ユーザースクリプト

## 概要

[The English version of README.md is available here](README.en.md)

Google掃除機(仮称)は、Googleの検索結果から特定のページを非表示にするGreasemonkey/Tampermonkey用ユーザースクリプトです。現在ウェブ検索結果・画像検索結果に対応しています。

[![Demonstration](https://github.com/djtkdk-086969/google-search-cleaner/wiki/img/demo.thumb.png)](https://github.com/djtkdk-086969/google-search-cleaner/wiki/img/demo.png)

[紹介動画（ニコニコ動画）](http://ext.nicovideo.jp/thumb_watch/sm29461061?thumb_mode=html) ※Ver. 1.1.1.086時点のものであり、現在の仕様とは多少異なる部分がありますのでご注意ください。

## 特長
本スクリプトには以下の機能があります。
* 検索結果を非表示にする条件を詳細に指定可能
* 条件に合致した検索結果について非表示にする以外の動作(警告の表示など)を行う
* 条件とそれに合致した検索結果に対する操作を合わせたルールの集まり(ルールセット)の複数作成・管理機能
* 検索結果からのルール作成機能
* 検索語句無視(未指定: ~~○○○~~)対策機能
* 2ページ目以降「もしかして:」を隠す機能
* 「関連する検索キーワード」(サジェスト)への「マイナス検索」の適用機能

特定のドメイン名(ホスト名)によるブロックだけではなく、URLの先頭一致や正規表現によるブロックも可能です。

## システム要件
* Mozilla Firefox (バージョン46以降)
* Greasemonkey (バージョン3.8以降)

または

* Google Chrome (最新版)
* Tampermonkey (最新版)

Ver. 1.1.0.078よりGoogle Chromeに対応しました。

## ライセンス
[GPL v3](http://www.gnu.org/copyleft/gpl.html)

## 作者
[たかだか。(TakaDaka.)](https://twitter.com/djtkdk_086969)