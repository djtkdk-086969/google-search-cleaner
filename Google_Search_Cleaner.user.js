// ==UserScript==
// @author         たかだか。(TakaDaka.)
// @name           Google掃除機(仮称)
// @namespace      https://twitter.com/djtkdk_086969
// @description    Googleの検索結果に出て欲しくないページを、条件を指定して非表示にします。
// @require        https://ajax.googleapis.com/ajax/libs/jquery/2.2.0/jquery.min.js
// @include        *://www.google.*/
// @include        *://www.google.*/?*
// @include        *://www.google.*/search*
// @include        *://www.google.*/webhp?*
// @exclude        *tbm=shop*
// @exclude        *tbm=vid*
// @version        1.1.0.085
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
// @grant          GM_addStyle
// @grant          GM_registerMenuCommand
// @license        GPL v3; http://www.gnu.org/copyleft/gpl.html
// @homepage       https://twitter.com/djtkdk_086969
// @compatible     firefox
// @compatible     chrome
// ==/UserScript==

/* Utility functions */

function escapeRegexp(string) {
    return string.replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1");
}
function chk_str(target, ref, method) {
    /*
      条件に合致した場合、合致した文字列を含む配列を返す。
      そうでない場合は null を返す。
      target: 対象の文字列
      ref:    検索文字列
      method: 検索方法
    */
    var r = null;
    if(method == "domain") {
        if(/^(https?|ftp):\/\/\S/.test(target)) { //正しいURLである
            var target_subdomain = target
                .split("/")[2]
                .split(":")[0]
                .split(".")
                .reverse()
                .filter(function(element) {return (element !== "");});
            var ref_subdomain = ref.split(".").reverse()
                .filter(function(element) {return (element !== "");});
            if (ref_subdomain.every(
                function(element, index, array) {
                    return array[index] == target_subdomain[index];
                })) {
                return [ref];
            } else {
                return null;
            }
        } else {
            return null;
        }
    } else if(method == "regexp") {
        r = new RegExp(ref, "i");
        return r.exec(target);
    } else if(method == "str") {
        r = new RegExp(escapeRegexp(ref), "i");
        return r.exec(target);
    } else if(method == "str_head") {
        r = new RegExp("^" + escapeRegexp(ref), "i");
        return r.exec(target);
    } else if(method == "word") {
        var words = ref.split(/\s+/);

        if (words.every(function(element, index, array) {
            if(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(element)) {
                /* キーワードに日本語(ひらがなカタカナ漢字)が含まれている 
                   →単純に部分一致検索する */
                r = new RegExp(escapeRegexp(element), "i");
                return r.test(target);
                
            } else {
                /* キーワードに日本語を含まない
                   →単語単位で検索(\bSTR\b) */
                r = new RegExp('(\\b|^)' + escapeRegexp(element) + '(\\b|$)', "i");
                return r.test(target);
            }
        })) {
            return words;
        } else {
            return null;
        }
    } else {
        return null;
    }
}

function decodeURI_s(url) {
    /* decodeURI() にデコードできないURIを食わせると
       URIError: malformed URI sequence
       となるので例外処理する */
    var url_decoded;
    try {
        url_decoded = decodeURI(url);
    }
    catch (e) {
        if (e instanceof URIError) {
            url_decoded = url;
        }
    }
    return url_decoded;
}

function check_rule(rule) {
    /* ルールが正常かどうかチェック */
    var target_allow = ["url", "description", "title", "suggest"];
    var type_allow = ["domain", "str", "str_head", "word", "regexp"];
    var action_allow = ["hide_absolutely", "hide", "hide_description_warn", "warn", "hide_description", "info", "allow"];
    
    return (typeof rule == "object" &&
            typeof rule.criteria == "string" &&
            typeof rule.target == "string" &&
            typeof rule.type == "string" &&
            typeof rule.action == "string" &&
            typeof rule.level == "number" &&
            !isNaN(rule.level) &&
            typeof rule.comment == "string" &&
            typeof rule.enabled == "boolean" &&
            target_allow.some(function(e) {
                return e === rule.target;
            }) &&
            type_allow.some(function(e) {
                return e === rule.type;
            }) &&
            action_allow.some(function(e) {
                return e === rule.action;
            })
           );
}

function check_config(config_json) {
    var valid = true;
    valid = (typeof config_json.config == "object" &&
             typeof config_json.rulesets == "object");
    if(valid) {
        jQuery.each(config_json.rulesets, function(id) {
            if(valid &&
               typeof this.name == "string" &&
               typeof this.enabled == "boolean" &&
               typeof this.rules == "object" &&
               jQuery.isArray(this.rules)){
                if(valid) {
                    jQuery.each(this.rules, function() {
                        if(!check_rule(this)) {
                            valid = false;
                            return false;
                        }
                    });
                }
            }
        });
    }
    return valid;
}

/* Utility functions (for UI) */
function gso_rseditor_update_selection() {
    /* ボタンの有効・無効、各入力フィールドの更新を行う
       (ルールセット内のルールの選択状態を変更したら呼び出すこと) */
    var rule = {};
    var selection_size = $("#gso_ruleset_table table tbody tr.gso_rule_selected").size();
    if(selection_size === 0) {
        $("#gso_rule_add").text("末尾に挿入");
        $("#gso_rule_overwrite").prop("disabled", true);
        $("#gso_rule_remove").prop("disabled", true);
        $("#gso_rule_moveup").prop("disabled", true);
        $("#gso_rule_movedown").prop("disabled", true);
        $("#gso_rule_criteria").attr("placeholder", "");
        $("#gso_rule_comment").attr("placeholder", "");
        /* 入力フィールドはそのままにする */
    } else if (selection_size == 1) {
        rule = config.rulesets[$("#gso_ruleset_select").val()]
            .rules[Number($("#gso_ruleset_table table tbody tr.gso_rule_selected:first").attr('data-idx'))];
        $("#gso_rule_add").text("選択されたルールの次に挿入");
        $("#gso_rule_overwrite").prop("disabled", false);
        $("#gso_rule_remove").prop("disabled", false);
        $("#gso_rule_moveup").prop("disabled", false);
        $("#gso_rule_movedown").prop("disabled", false);

        $("#gso_rule_criteria").attr("placeholder", "");
        $("#gso_rule_comment").attr("placeholder", "");
        $("#gso_rule_target").val(rule.target);
        $("#gso_rule_type").val(rule.type);
        $("#gso_rule_action").val(rule.action);
        $("#gso_rule_level").val(rule.level);
        $("#gso_rule_criteria").val(rule.criteria);
        $("#gso_rule_comment").val(rule.comment);
        $("#gso_rule_enabled").prop("checked", rule.enabled);
    } else {
        $("#gso_rule_add").text("末尾に挿入");
        $("#gso_rule_overwrite").prop("disabled", false);
        $("#gso_rule_remove").prop("disabled", false);
        $("#gso_rule_moveup").prop("disabled", true);
        $("#gso_rule_movedown").prop("disabled", true);
        $("#gso_rule_criteria").attr("placeholder", "(変更しない)");
        $("#gso_rule_comment").attr("placeholder", "(変更しない)");


        var data = {};

        $("#gso_ruleset_table table tbody tr.gso_rule_selected").each(function() {
            rule = config.rulesets[$("#gso_ruleset_select").val()].rules[Number($(this).attr('data-idx'))];
            Object.keys(rule).forEach(function (k) {
                if (data[k] === undefined) {
                    data[k] = rule[k];
                } else if (data[k] != rule[k]) {
                    data[k] = "";
                }
            });
        });

        $("#gso_rule_target").val(data.target);
        $("#gso_rule_type").val(data.type);
        $("#gso_rule_action").val(data.action);
        $("#gso_rule_level").val(data.level);
        $("#gso_rule_criteria").val(data.criteria);
        $("#gso_rule_comment").val(data.comment);

    }
    if(selection_size === 0) {
        $("#gso_rule_count").text($("#gso_ruleset_table table tbody tr").size() + "個のルール");
    } else {
        $("#gso_rule_count").text($("#gso_ruleset_table table tbody tr").size() +
                                  "個のルール (" + selection_size + "個選択済)");
    }
}

function gso_rseditor_update_rslist() {
    /* ルールセットのリストを更新 */
    var id = $("#gso_ruleset_select").val();
    var ruleset = config.rulesets[id];
    $("#gso_ruleset_select option[value='"+ id +"']")
        .text(gso_rseditor_rslist_str(id, ruleset.name, ruleset.enabled));
}

function gso_rseditor_rslist_str(key, name, enabled) {
    return name + ' [' + key + ']' + (enabled ? '' : '[無効]');
}

function gso_log_append(type, target, matched, title, url, ruleset, action, action_effective, override) {
    /* ログに表示 */
    var table = $("#gso_log_table table tbody");
    var type_res = {"page": "ページ",
                   "missing": "検索語句無視",
                   "img": "画像",
                   "suggest": "関連語句",
                   "suggest_excl": "関連(-除外)",
                   "autocomplete": "検索語句予測"};
    var row_style = 0;
    
    if(table.find("tr").size() >= 1) {
        if(table.find("tr:last").attr("data-last-rule") === undefined) {
            if(table.find("tr:last").hasClass("gso_log_a")){            
                row_style = 0;
            } else {
                row_style = 1;
            }
        } else {
            if(table.find("tr:last").hasClass("gso_log_a")){            
                row_style = 1;
            } else {
                row_style = 0;
            }
        }
    } else {
        row_style = 0;        
    }
    table.append(
        "<tr><td>" + type_res[type] +
            "</td><td>" +
            "</td><td>" +
            "</td><td>" +
            "</td><td>" +
            "</td><td>" +
            "</td><td>" +
            "</td></tr>");
    if(row_style === 0) {
        table.find("tr:last").addClass("gso_log_a");
    } else {
        table.find("tr:last").addClass("gso_log_b");
    }

    if(override) {
        table.find("tr:last").addClass("gso_log_overridden");
    }
    if(action_effective == "hide_absolutely") {
        if(ruleset !== null) {
            table.find("tr:last td:eq(2)")
                .append("<div style='width: 100%; color: silver;' title='「完全に非表示」動作のため表示できません'>表示不可</div>");
        }
        if(ruleset !== null) {
            table.find("tr:last td:eq(5)")
                .append("<div title='[" + ruleset + "]" + config.rulesets[ruleset].name +
                        "' style='width: 100%; background-color: silver; text-align: center;'>…</div>");
        }
        if(action !== null) {
            table.find("tr:last td:eq(6)")
                .append("&gt;&gt; " + cat.full.action[action]);
        }
        table.find("tr:last td:eq(4)").remove();
        table.find("tr:last td:eq(3)").remove();
        table.find("tr:last td:eq(2)").attr("colspan", "3");

    } else {
        if(matched !== null) {
            table.find("tr:last td:eq(2)").text(matched);
        }
        if(title !== null) {
            table.find("tr:last td:eq(3)")
                .append("<div title='" + title + "' style='width: 100%; background-color: silver; text-align: center;'>…</div>");
        }
        if(url !== null) {
            table.find("tr:last td:eq(4)")
                .append("<div title='" + decodeURI_s(url) + "' style='width: 100%; background-color: silver; text-align: center;'>…</div>");
        }
        if(ruleset !== null) {
            table.find("tr:last td:eq(5)")
                .append("<div title='[" + ruleset + "]" + config.rulesets[ruleset].name +
                        "' style='width: 100%; background-color: silver; text-align: center;'>…</div>");
        }
        if(action !== null) {
            table.find("tr:last td:eq(6)")
                .append("&gt;&gt; " + cat.full.action[action]);
        }
    }

    if(target === null) {
        table.find("tr:last td:eq(1)").remove();
        table.find("tr:last td:first").attr("colspan", "2");
    } else {
        table.find("tr:last td:eq(1)").text(cat.abbrev.target[target]);
    }
}
function gso_log_setBoundary() {
    /*
      ログにおける検索結果の境界を設定
      複数のルールに合致した際などにどのルールがどの検索結果に合致したか
      わかりやすくする
    */
    $("#gso_log_table table tbody").find("tr:last").attr("data-last-rule", "last-rule");
}
function gso_rseditor_toggle() {
    $("#gso_config").toggle();
}

/* GM_setValue / GM_getValue */
function gso_save() {
    /* GM_setValue で現在の設定値(config)を保存する */
    GM_setValue("quick_block", config.config.quick_block);
    GM_setValue("check_for_image", config.config.check_for_image);
    GM_setValue("ruleset_name_with_comment", config.config.ruleset_name_with_comment);
    GM_setValue("fix_missing", config.config.fix_missing);
    GM_setValue("hide_moshikashite", config.config.hide_moshikashite);
    GM_setValue("force_keyword_exclusion_on_suggestion", config.config.force_keyword_exclusion_on_suggestion);
    GM_setValue("always_log_checked_entries", config.config.always_log_checked_entries);
    GM_setValue("float", config.config.float);
    GM_setValue("animation", config.config.animation);
    GM_setValue("verbose", config.config.verbose);

    GM_setValue("rulesets", JSON.stringify(config.rulesets));
    console.log("saved configuration");
    console.log(JSON.parse(GM_getValue("rulesets")));
}

function gso_load() {
    /* GM_getValue で設定を読み込む
       値が設定されていなかったらデフォルト値を読み込む */
    console.log("loading configuration");
    config = {};
    config.config = {};
    config.rulesets = {};
    
    config.config.quick_block = GM_getValue("quick_block", config_default.config.quick_block);
    config.config.check_for_image = GM_getValue("check_for_image", config_default.config.check_for_image);
    config.config.ruleset_name_with_comment = GM_getValue("ruleset_name_with_comment", config_default.config.ruleset_name_with_comment);
    config.config.fix_missing = GM_getValue("fix_missing", config_default.config.fix_missing);
    config.config.hide_moshikashite = GM_getValue("hide_moshikashite", config_default.config.hide_moshikashite);
    config.config.force_keyword_exclusion_on_suggestion = GM_getValue("force_keyword_exclusion_on_suggestion", config_default.config.force_keyword_exclusion_on_suggestion);
    config.config.always_log_checked_entries = GM_getValue("always_log_checked_entries", config_default.config.always_log_checked_entries);
    config.config.float = GM_getValue("float", config_default.config.float);
    config.config.animation = GM_getValue("animation", config_default.config.animation);
    config.config.verbose = GM_getValue("verbose", config_default.config.verbose);

    config.rulesets = JSON.parse(GM_getValue("rulesets", '{"default":{"name":"既定のルールセット","enabled":true,"rules":[{"action":"hide","comment":"","criteria":"example.com","enabled":false,"level":0,"target":"url","type":"domain"}]}}'));
    console.log("loaded configuration");
    console.log(config);
    
    jQuery.fx.off = !config.config.animation;
}

/* Import / Export */
function gso_import_ruleset(rules, key) {
    if(typeof rules == "object" &&
       jQuery.isArray(rules)){
        var imported_count = 0;
        var malformed_entry = null;
        jQuery.each(rules, function() {
            if(check_rule(this)) {
                imported_count++;
                config.rulesets[key].rules.push(jQuery.extend(true, {}, this));
            } else {
                malformed_entry = this;
            }
        });
        if (imported_count == rules.length) {
            console.log("imported:", imported_count);
        } else if(imported_count == rules.length - 1) {
            console.log("imported:", imported_count);
            console.log("malformed:", JSON.stringify(malformed_entry));
        } else {
            console.log("imported:", imported_count);
            console.log("malformed:", JSON.stringify(malformed_entry));
        }
    } else {
        console.log("import failed (invalid format)");
    }
}


/* Initialization functions */

function gso_config_rseditor_init() {
    $("#gso_ruleset_select option").remove();
    jQuery.each(config.rulesets, function(id) {
        $("#gso_ruleset_select").append(
            '<option value="' + id + '">' +
                gso_rseditor_rslist_str(id, this.name, this.enabled) +
                '</option>');
    });
    
    $("#gso_ruleset_select").change();

    $("#gso_ruleset_remove").prop("disabled", $("#gso_ruleset_select option").size() <= 1);
}

function gso_config_init() {
    gso_config_rseditor_init();
    $("#gso_config_misc input").each(function() {
        $(this).prop("checked", config.config[$(this).val()]);
    });
}



var cat = {
    "abbrev": {
        "target": {
            "url": "URL",
            "description": "説明",
            "title": "題名",
            "suggest": "関連"
        },
        "type": {
            "domain": "ドメイン",
            "str": "文字列",
            "str_head": "頭文字列",
            "word": "ワード",
            "regexp": "正規表現",
        },
        "action": {
            "hide_absolutely": "禁止",
            "hide": "隠す",
            "hide_description_warn": "⚠縮",
            "warn": "⚠",
            "hide_description": "縮小",
            "info": "通知",
            "allow": "許可"
        }
    },
    "full": {
        "target": {
            "url": "URL",
            "description": "説明文",
            "title": "タイトル",
            "suggest": "サジェスト"
        },
        "type": {
            "domain": "ドメイン",
            "str": "文字列",
            "str_head": "文字列(先頭一致)",
            "word": "ワード",
            "regexp": "正規表現",
        },
        "action": {
            "hide_absolutely": "完全に非表示",
            "hide": "非表示",
            "hide_description_warn": "警告+説明文非表示",
            "warn": "警告",
            "hide_description": "通知+説明文非表示",
            "info": "通知",
            "allow": "許可"
        }
    }
};

var action_priority = {
    "hide_absolutely": 6,
    "hide": 5,
    "hide_description_warn": 4,
    "warn": 2,
    "hide_description": 3,
    "info": 1,
    "allow": 0,
    "undef": -1
};

/* 現在の設定 */
var config = null;

/* デフォルトの設定 */
var config_default = {
    "rulesets": {
        "default": {
            "name": "既定のルールセット",
            "enabled": true,
            "rules": [
            ]},
    },
    'config': {
        'quick_block': false,
        'check_for_image': true,
        'ruleset_name_with_comment': false,
        'fix_missing': true,
        'hide_moshikashite': true,
        'force_keyword_exclusion_on_suggestion': false,
        'always_log_checked_entries': false,
        'float': true,
        'animation': true,
        'verbose': false
    }
};

(function() {
    console.log("Google Search Cleaner " + GM_info.script.version + " started.");
    gso_load(); /* 設定を読み込む */

    GM_registerMenuCommand("Google掃除機 設定", gso_rseditor_toggle);
    GM_addStyle("span.gso_killed_serp_msg { color: silver; margin: 0 0; }");
    GM_addStyle("*.gso_killed_serpimg_warn { display: block; position: absolute; width: 100%; height: 100%; z-index: 100; font-size: 0.60em; top: 0px; left: 0px;}");
    GM_addStyle("*.gso_killed_img_mask_serp {background-color: #ffffff;}");
    GM_addStyle("*.gso_killed_img_mask_isch {background-color: #f1f1f1;}");
    GM_addStyle("span.gso_killed_kw_bad { color: silver; text-decoration: line-through; white-space: nowrap;}");
    GM_addStyle("span.gso_killed_kw_placeholder {border: 1px solid; white-space: nowrap;}");
    GM_addStyle("li.gso_killed_kw_autocomplete { display: none !important;}");
    GM_addStyle("span.gso_killed_url { font-size: 0.60em; text-decoration:line-through;}");
    GM_addStyle("#gso_control { left: 0px; z-index: 999; width: 120px; background-color: white; border: 1px solid black; text-align: center; }");
    GM_addStyle("#gso_results_msg_eff { position: absolute; left: 0px; top: 0px; width: 100%; height: 100%; background-color: pink; display: none; }");
    GM_addStyle("#gso_config { right: 0px; z-index: 999; width: 480px; background-color: white; border: 1px solid black; display: none; -moz-user-select: none; font-size: x-small;}");
    GM_addStyle("*.gso_control_msg {font-size: 0.80em;}");
    GM_addStyle("*.gso_control_buttons {font-size: inherit;}");
    GM_addStyle("*.gso_quick_block {font-size: smaller;}");
    //GM_addStyle("div.gso_killed_count { display: inline-block; padding: 8px; }");
    GM_addStyle("span.gso_ignored_kw { font-weight: bold; }");
    GM_addStyle("*.gso_float { position: fixed; top: 0px; }");
    GM_addStyle("*.gso_control_embedded { position: absolute; top: 110px; }");
    GM_addStyle("*.gso_config_embedded { position: absolute; top: 0px; }");
    GM_addStyle("*.gso_serp_description_info { display: block; background: lightgray; }");
    GM_addStyle("*.gso_serp_description_warning { display: block; color: darkred;}");
    GM_addStyle("tr.gso_rule_selected {background-color: pink;}");
    GM_addStyle("tr.gso_rule_disabled {text-decoration: line-through;}");
    GM_addStyle("tr.gso_log_a {background-color: inherit;}");
    GM_addStyle("tr.gso_log_b {background-color: whitesmoke;}");
    GM_addStyle("*.gso_log_overridden {text-decoration: line-through; color: silver;}");

    var selector_SERP =
        "div.rc:has(h3.r > a)," +
        "li.g:has(a._Dk)," +
        "div.g:has(a._Dk)," +
        "div._lnc div._cnc," +
        "div._lnc div._hnc," +
        "div._lnc div._Xmc," +
        "div.sld:has(h3.r > a.l)," +
        "div._knc:has(h3.r > a.l)," +
        "a._rQb, " +
        "div._lnc > a.top";
    /*
      サイト内検索: div.rc:has(h3.r > a)
      ニューストピック: li.g:has(a._Dk), div.g:has(a._Dk)
    */

    var selector_IMG = 
        "div.img-brk li.rg_el, " +
        "div.img-brk div.rg_el";
    /*
      画像検索結果(旧): div.img-brk li.rg_el
      画像検索結果: div.img-brk div.rg_el
    */
    
    var selector_IMGLIST =
        "div#isr_mc div.rg_el";

    var selector_KW = "div#trev a, div#brs p._e4b > a";
    /* 関連する検索キーワード */

    var status = {
        "show_serp": false,
        "show_img": false,
        "show_kw": false
    };
    
    function check(url, description, title, keyword, temp_rulesets) {
        /* ルールセットに合致するかどうかチェック
           優先度ごとに最初に合致したルールと内包するルールセットを
           表すオブジェクトの配列を返す。
           そうでなければ 空の配列 を返す。*/
        var query = null;
        var rulesets = null;

        var matched_rules = [];
        var last_level = -1;

        if(temp_rulesets === null) {
            rulesets = config.rulesets;
        } else {
            rulesets = temp_rulesets;
        }

        jQuery.each(rulesets, function(id) {
            /* for each ruleset in rulesets */
            if(this.enabled) { /* this ruleset is enabled */
                jQuery.each(this.rules, function() {
                    /* for each rule in ruleset */
                    if(this.enabled && this.level - last_level <= 1) {
                        if(this.target == "suggest") {
                            query = keyword;
                        } else if(this.target == "url") {
                            query = decodeURI_s(url);
                        } else if(this.target == "title") {
                            query = title;
                        } else if(this.target == "description") {
                            query = description;
                        }
                        if(query !== null) {
                            var matched = chk_str(query, this.criteria, this.type);
                            if (matched !== null) {
                                if(this.level <= last_level) {
                                    matched_rules.push(matched_rules[matched_rules.length-1].filter(function(e) {
                                        return e.rule.level < this.level;
                                    }));
                                }
                                if(last_level < 0) {
                                    matched_rules.push([]);
                                }
                                matched_rules[matched_rules.length-1].push({
                                    "ruleset_id": id,
                                    "rule": this,
                                    "matched": matched.join(" ")
                                });

                                last_level = this.level;
                            }
                        }
                    }
                });
            }
        });
        return matched_rules;
    }
    
    function get_most_significant_rule(matched_rules) {
        /* 複数のルール(のツリー)に合致した場合、最も厳しい処理を適用する */
        var context = null;
        var action = action_priority.undef;
        matched_rules.forEach(function(element) {
            if(action < action_priority[element[element.length - 1].rule.action]) {
                if(context !== null) {
                    delete context.effective;
                }
                context = element[element.length - 1];
                action = action_priority[element[element.length - 1].rule.action];
                context.effective = true;
            }
        });
        return context;
    }

    if($("#gso_control").size() === 0) {
        /* 結果表示 */
        $("body").prepend(
            '<div id="gso_control" class="gso_control_msg gso_control_embedded" style="display: none;">' +
                '<em>GSC</em>' +
                '<div id="gso_results_msg_eff"></div>' +
                '<div id="gso_results_msg_top"></div>' +
                '<ul style="list-style-type: none;">' +
                '<li style="display:none"><button type="button" id="gso_killed_count_s" class="gso_control_buttons">R</button></li>' +
                '<li style="display:none"><button type="button" id="gso_killed_count_si" class="gso_control_buttons">I</button></li>' +
                '<li style="display:none"><button type="button" id="gso_killed_count_k" class="gso_control_buttons">S</button></li>' +
                '<li id="gso_count_ik" style="display:none">検索語句無視!</li>' +
                '</ul>' +
                '</div>'
            

        );
        $("#gso_killed_count_s").click(function () {
            if(status.show_serp) {
                status.show_serp = false;
            } else {
                status.show_serp = true;
            }
            update_serp();
        });
        $("#gso_killed_count_si").click(function () {
            if(status.show_img) {
                status.show_img = false;
            } else {
                status.show_img = true;
            }
            update_img();
        });
        $("#gso_killed_count_k").click(function () {
            if(status.show_kw) {
                status.show_kw = false;
            } else {
                status.show_kw = true;
            }
            update_kw();
        });
        $("body").prepend('<form id="gso_config" class="gso_config_embedded">' +
                          '<button type="button" id="gso_config_close" class="gso_control_buttons">閉じる</button>' +
                          '<fieldset>' +
                          '<legend><button type="button" id="gso_ruleset_editor_toggle" class="gso_control_buttons">▲</button>ルールセットの編集</legend>' +
                          '<div id="gso_ruleset_editor">' +
                          '<label for="gso_ruleset_select">ルールセット:</label>' +
                          '<select id="gso_ruleset_select" name="gso_ruleset_select"></select>' +
                          '<input id="gso_ruleset_enabled" type="checkbox" value="gso_ruleset_enabled">有効' +
                          '<hr>' +
                          '<div>' +
                          '<table style="width:440px; border-spacing: 0px 2px;">' +
                          '<colgroup>' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 4.5em; min-width: 4.5em;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 2em; min-width: 2em;">' +
                          '<col style="width: 248px;">' +
                          '<col style="width: 1em; min-width: 1em;">' +
                          '</colgroup>' +
                          '<thead>' +
                          '<tr style="font-weight: bold; background-color: lightgray;">' +
                          '<td>対象</td>' +
                          '<td>検索方法</td>' +
                          '<td>動作</td>' +
                          '<td>Lv</td>' +
                          '<td>条件文字列</td>' +
                          '<td>C</td>' +
                          '</tr>' +
                          '</thead>' +
                          '</table>' +
                          '<div id="gso_ruleset_table" style="height: 100px; width: 100%; overflow-y: scroll; overflow-x: hidden;">' +
                          '<table style="width:440px; border-spacing: 0px 2px;">' +
                          '<colgroup>' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 4.5em; min-width: 4.5em;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 2em; min-width: 2em;">' +
                          '<col style="width: 248px;">' +
                          '<col style="width: 1em; min-width: 1em;">' +
                          '</colgroup>' +
                          '<tbody>' +
                          '</tbody>' +
                          '</table>' +
                          '</div>' +
                          '<button type="button" id="gso_ruleset_selectAll" class="gso_control_buttons">全選択</button>' +
                          '<button type="button" id="gso_ruleset_unselectAll" class="gso_control_buttons">全解除</button>' +
                          '<button type="button" id="gso_ruleset_selectToggle" class="gso_control_buttons">選択の切替</button>' +
                          '<span id="gso_rule_count"></span><br>' +
                          '選択されたルールを移動' +
                          '<button type="button" id="gso_rule_moveup" class="gso_control_buttons">▲</button>' +
                          '<button type="button" id="gso_rule_movedown" class="gso_control_buttons">▼</button>' +
                          '選択されたルールを<button type="button" id="gso_rule_remove" class="gso_control_buttons">削除</button>' +
                          '<hr>' +
                          '<div style="width:100%;">' +
                          '<div style="display: inline-block;">' +
                          '有効<br>' +
                          '<input id="gso_rule_enabled" type="checkbox" value="gso_rule_enabled">' +
                          '</div>' +
                          '<div style="display: inline-block;">' +
                          '対象:<br>' +
                          '<select id="gso_rule_target" name="gso_rule_target">' +
                          '<option value="url">URL</option>' +
                          '<option value="description">説明文</option>' +
                          '<option value="title">タイトル</option>' +
                          '<option value="suggest">サジェスト</option>' +
                          '</select>' +
                          '</div>' +
                          '<div style="display: inline-block;">' +
                          '検索方法:<br>' +
                          '<select id="gso_rule_type" name="gso_rule_type">' +
                          '<option value="domain">ドメイン</option>' +
                          '<option value="str">文字列</option>' +
                          '<option value="str_head">文字列(先頭一致)</option>' +
                          '<option value="word">ワード</option>' +
                          '<option value="regexp">正規表現</option>' +
                          '</select>' +
                          '</div>' +
                          '<div style="display: inline-block;">' +
                          '動作:<br>' +
                          '<select id="gso_rule_action" name="gso_rule_action">' +
                          '<option value="hide_absolutely">完全に非表示</option>' +
                          '<option value="hide">非表示</option>' +
                          '<option value="hide_description_warn">説明文非表示+警告</option> ' +
                          '<option value="hide_description">説明文非表示+通知</option>' +
                          '<option value="warn">警告</option>' +
                          '<option value="info">通知</option>' +
                          '<option value="allow">許可</option>' +
                          '</select>' +
                          '</div>' +
                          '<div style="display: inline-block;">' +
                          'レベル:<br>' +
                          '<input type="text" id="gso_rule_level" name="gso_rule_level" placeholder="0" style="width: 2em;">' +
                          '</div>' +
                          '<div style="display: inline-block;">' +
                          '条件文字列:<br>' +
                          '<textarea type="text" id="gso_rule_criteria" name="gso_rule_criteria" placeholder="" style="width: 210px; font-size: inherit;"></textarea>' +
                          '</div>' +
                          '<div style="display: inline-block;">' +
                          'コメント:<br>' +
                          '<textarea type="text" id="gso_rule_comment" name="gso_rule_comment" placeholder="" style="width: 210px; font-size: inherit;"></textarea>' +
                          '</div>' +
                          '</div>' +
                          '<button type="button" id="gso_rule_add" class="gso_control_buttons">末尾に挿入</button>' +
                          '<button type="button" id="gso_rule_overwrite" class="gso_control_buttons">上書</button>' +
                          '</div>' +
                          '</div>' +
                          '</fieldset>' +
                          '<fieldset>' +
                          '<legend><button type="button" id="gso_ruleset_manager_toggle" class="gso_control_buttons">▼</button>ルールセットの管理</legend>' +
                          '<div id="gso_ruleset_manager" style="display: none;">' +
                          '現在のルールセットの表示名:<input type="text" id="gso_ruleset_name" name="gso_ruleset_name" placeholder="表示名" style="width: auto;"><br>' +
                          '<button type="button" id="gso_ruleset_remove" class="gso_control_buttons">現在のルールセットを削除</button><br>' +
                          '<input type="text" id="gso_new_ruleset_key" name="gso_new_ruleset_key" placeholder="キー" style="width: 6em;">' +
                          '<button type="button" id="gso_ruleset_add" class="gso_control_buttons">新規ルールセット追加</button><hr>' +
                          'ファイルからインポートして現在のルールセットに追加' +
                          '<input type="file" id="gso_ruleset_importJSON" name="rulesetJSON[]"><br>' +
                          '選択範囲をエクスポート<button type="button" id="gso_ruleset_exportJSON" class="gso_control_buttons">JSON</button>' +
                          '<button type="button" id="gso_ruleset_exportURL" class="gso_control_buttons">URLリスト(不完全)</button>' +
                          '<a id="gso_ruleset_export_dllink" style="display: none;">.</a>' +
                          '</div>' +
                          '</fieldset>' +
                          '<fieldset>' +
                          '<legend><button type="button" id="gso_log_toggle" class="gso_control_buttons">▼</button>活動ログ</legend>' +
                          '<div id="gso_log" style="display: none;">' +
                          '<div>' +
                          '<table style="width:440px; border-spacing: 0px 2px;">' +
                          '<colgroup>' +
                          '<col style="width: 4em; min-width: 4em;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 175px;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 11em; min-width: 11em;">' +
                          '</colgroup>' +
                          '<thead>' +
                          '<tr style="font-weight: bold; background-color: lightgray;">' +
                          '<td>種類</td>' +
                          '<td>対象</td>' +
                          '<td>合致した文字列</td>' +
                          '<td>T/KW</td>' +
                          '<td>URL</td>' +
                          '<td>RS</td>' +
                          '<td>動作</td>' +
                          '</tr>' +
                          '</thead>' +
                          '</table>' +
                          '<div id="gso_log_table" style="height: 100px; width: 100%; overflow-y: scroll; overflow-x: hidden;">' +
                          '<table style="width:440px; border-spacing: 0px 0px;">' +
                          '<colgroup>' +
                          '<col style="width: 4em; min-width: 4em;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 175px;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 3em; min-width: 3em;">' +
                          '<col style="width: 11em; min-width: 11em;">' +
                          '</colgroup>' +
                          '<tbody>' +
                          '</tbody>' +
                          '</table>' +
                          '</div>' +
                          '</div>' +
                          '<button type="button" id="gso_log_clear" class="gso_control_buttons">クリア</button><br>' +
                          '<span style="background-color: silver;">…</span> をポイントすると詳細が表示されます。<br>' +
                          '<span class="gso_log_overridden">この表示</span>は他のルールにより動作が上書きされたことを表します。<br>' +
                          '</div>' +
                          '</fieldset>' +
                          '<fieldset>' +
                          '<legend><button type="button" id="gso_config_misc_toggle" class="gso_control_buttons">▼</button>その他の設定</legend>' +
                          '<div id="gso_config_misc" style="display: none;">' +
                          '<input type="checkbox" value="quick_block">検索結果にクイックブロックボタンを表示<br>' +
                          '<input type="checkbox" value="check_for_image">画像検索のチェック<br>' +
                          '<input type="checkbox" value="ruleset_name_with_comment">プレースホルダにコメントを表示する<br>'+
                          '(「#」で始まるコメントはこの設定を有効にしても表示されません)<br>' +
                          '<input type="checkbox" value="fix_missing">検索語句無視対策機能を有効にする<br>' +
                          '<input type="checkbox" value="hide_moshikashite">2ページ目以降「もしかして：」を隠す<br>' +
                          '<input type="checkbox" value="force_keyword_exclusion_on_suggestion">サジェストに「マイナス検索」を適用<br>' +
                          '<input type="checkbox" value="always_log_checked_entries">合致したルールが存在しなくてもチェックされた項目を全て記録する<br>' +
                          '<input type="checkbox" value="float">スクロールに追従する<br>' +
                          '<input type="checkbox" value="animation">アニメーション<br>' +
                          '</div>' +
                          '</fieldset>' +
                          '<fieldset>' +
                          '<legend><button type="button" id="gso_backup_toggle" class="gso_control_buttons">▼</button>バックアップ/復元/初期化</legend>' +
                          '<div id="gso_backup" style="display: none;">' +
                          '<button type="button" id="gso_exportAllJSON" class="gso_control_buttons">ファイルにバックアップ</button><br>' +
                          '全設定をファイルから復元' +
                          '<input type="file" id="gso_importAllJSON" name="rulesetJSON[]"><br><br>' +
                          '<div style="text-align: right;">' +
                          '<button type="button" id="gso_resetAll" class="gso_control_buttons" data-phase="0">全設定を初期化(元に戻せません!)</button>' +
                          '</div>' +
                          '</div>' +
                          '</fieldset>' +
                          '<fieldset>' +
                          '<legend><button type="button" id="gso_about_toggle" class="gso_control_buttons">▼</button>バージョン情報</legend>' +
                          '<div id="gso_about" style="display: none;">' +
                          'Google掃除機(仮称) Google Search Cleaner ' + GM_info.script.version + '<br>' +
                          '作者: たかだか。(TakaDaka.) <a href="https://twitter.com/djtkdk_086969" target="_blank">Twitter</a> <a href="https://greasyfork.org/ja/users/29445-%E3%81%9F%E3%81%8B%E3%81%A0%E3%81%8B-takadaka" target="_blank">Greasy Fork</a> <a href="https://github.com/djtkdk-086969" target="_blank">GitHub</a><br>' +
                          'ライセンス: GPL v3<br>' +
                          '本スクリプトは<a href="https://jquery.com/" target="_blank">jQuery 2.2.0</a>を利用しています。<br>jQueryはMIT Licenseのもとで提供されています。' +
                          '</div>' +
                          '</fieldset>' +
                          '<button type="button" id="gso_save" class="gso_control_buttons">変更を保存</button>' +
                          '<button type="button" id="gso_revert" class="gso_control_buttons">変更を破棄</button>' +
                          '<span id="gso_status">[変更を保存]をクリックするまで設定は保存されません</span>' +
                          '</form>');

        /* Event handlers */

        $("#gso_config_close").click(function () {
            $("#gso_config").toggle();
        });

        $("#gso_new_ruleset_key").change(function () {
            var key = $(this).val();
            var already_exists = false;
            if(key === null || key === "") {
                $("#gso_ruleset_add").prop("disabled", true);
            } else {
                already_exists = Object.keys(config.rulesets).some(function(e) {
                    return e === key;
                });
                $("#gso_ruleset_add").prop("disabled", already_exists);
            }
        });

        $("#gso_ruleset_remove").click(function () {
            if(Object.keys(config.rulesets).length > 1) {
                delete config.rulesets[$("#gso_ruleset_select").val()];
                gso_config_rseditor_init();
            } else {
                $("#gso_status").text("最後のルールセットは削除できません");
            }
        });

        $("#gso_ruleset_add").click(function () {
            var key = $("#gso_new_ruleset_key").val();
            var already_exists = false;
            if(key === null || key === "") {
                /* no key or name is given */
                return;
            }
            already_exists = Object.keys(config.rulesets).some(function(e) {
                return e === key;
            });
            if(!already_exists) {
                /* add new ruleset */
                config.rulesets[key] = {
                    "name": "(無題)",
                    "enabled": true,
                    "rules": [
                    ]};
                gso_config_rseditor_init();
            }
        });


        $("#gso_ruleset_select").change(function () {
            $("#gso_config button").removeAttr("disabled");
            $("#gso_ruleset_table table tbody tr").remove();
            var ruleset = config.rulesets[$("#gso_ruleset_select").val()];
            jQuery.each(ruleset.rules, function(i) {
                var table = $("#gso_ruleset_table table tbody").append(
                    "<tr data-idx='" + i +"'>" +
                        "<td>" + cat.abbrev.target[this.target] +
                        "</td><td>" + cat.abbrev.type[this.type] +
                        "</td><td><div title='" + cat.full.action[this.action] +
                        "' style='width: 100%;'>" + cat.abbrev.action[this.action] +
                        "</div></td><td>" + this.level +
                        "</td><td style='overflow: hidden; white-space: nowrap; width: 248px; max-width: 248px; text-overflow: ellipsis;'>" + this.criteria +
                        "</td><td>" +
                        "</td></tr>");
                if(this.comment !== "") {
                    table.find("tr:last td:eq(5)")
                        .append("<div title='" + this.comment + "' style='width: 100%; background-color: silver;'>…</div>");
                }
                if(!this.enabled) {
                    table.find("tr:last").addClass("gso_rule_disabled");
                }
            });
            $("#gso_ruleset_enabled").prop("checked", ruleset.enabled);
            $("#gso_ruleset_name").val(ruleset.name);

            $("#gso_ruleset_table table tbody tr").click(function () {
                $(this).toggleClass("gso_rule_selected");
                gso_rseditor_update_selection();
            });
            gso_rseditor_update_selection();
        });

        $("#gso_ruleset_name").change(function () {
            var ruleset = config.rulesets[$("#gso_ruleset_select").val()];
            ruleset.name = $(this).val();
            gso_rseditor_update_rslist();
        });
        $("#gso_ruleset_enabled").change(function () {
            var ruleset = config.rulesets[$("#gso_ruleset_select").val()];
            ruleset.enabled = $(this).prop("checked");
            gso_rseditor_update_rslist();
        });

        $("#gso_ruleset_exportJSON").click(function () {
            var rules = [];
            $("#gso_ruleset_table table tbody tr.gso_rule_selected").each(function() {
                rules.push(config.rulesets[$("#gso_ruleset_select").val()].rules[Number($(this).attr('data-idx'))]);
            });
            var export_json = JSON.stringify(rules);
            var blob = new Blob([export_json], {'type': 'application/json'});
            var dl_link = document.getElementById('gso_ruleset_export_dllink');
            dl_link.target = '_blank';
            dl_link.download = "rules.json";
            dl_link.href = (window.URL || window.webkitURL).createObjectURL(blob);
            dl_link.click();
            dl_link.href = "#";
        });
        $("#gso_ruleset_exportURL").click(function () {
            var text = [];
            var rule;
            $("#gso_ruleset_table table tbody tr.gso_rule_selected").each(function() {
                rule = config.rulesets[$("#gso_ruleset_select").val()].rules[Number($(this).attr('data-idx'))];
                if(rule.type == "str" || rule.type == "domain" || rule.type == "word") {
                    text.push(rule.criteria);
                } else if(rule.type == "str_head") {
                    text.push("/^" + rule.criteria + "/i");
                } else if(rule.type == "regexp") {
                    text.push("/" + rule.criteria + "/i");
                }
            });
            var export_text = text.join("\n");
            var blob = new Blob([export_text], {'type': 'text/plain'});
            var dl_link = document.getElementById('gso_ruleset_export_dllink');
            dl_link.target = '_blank';
            dl_link.download = "rules.txt";
            dl_link.href = (window.URL || window.webkitURL).createObjectURL(blob);
            dl_link.click();
            dl_link.href = "#";
        });
        $("#gso_ruleset_importJSON").change(function (event) {
            var rules_json;
            var key = $("#gso_ruleset_select").val();
            if (key === "") {
                return false;
            } else {
                var file = event.target.files[0];
                /* MacではOKだが、Windowsだとfile.typeは空になる
                   if(file.type != 'application/json' && file.type != 'text/plain') {
                   return true; // continue
                   }
                */                
                var reader = new FileReader();
                reader.onload = (function(file) {
                    return function(evt) {
                        try {
                            rules_json = JSON.parse(evt.target.result);
                        }
                        catch (e) {
                            if (e instanceof SyntaxError) {
                                /* JSONの構文が正しくない 単純リスト形式でのインポートを試みる */
                                console.log("Invalid JSON syntax. Attempting to read as a simple list.");
                                var text = evt.target.result.split(/\r\n|\r|\n/);
                                rules_json = [];
                                text.forEach(function(element) {
                                    if(/^([a-zA-Z0-9][a-zA-Z0-9\-]*\.)+[a-zA-Z]+$/.test(element)) {
                                        /* ドメイン名 */
                                        rules_json.push({
                                            "target": "url",
                                            "type": "domain",
                                            "action": "hide",
                                            "level": 0,
                                            "criteria": element,
                                            "comment": "",
                                            "enabled": true
                                        });
                                    } else {
                                        /* そうでない場合は対象「URL」、文字列単純検索を仮定する */
                                        rules_json.push({
                                            "target": "url",
                                            "type": "str",
                                            "action": "hide",
                                            "level": 0,
                                            "criteria": element,
                                            "comment": "",
                                            "enabled": true
                                        });
                                    }
                                });
                            }
                        }
                        gso_import_ruleset(rules_json, key);
                        gso_config_rseditor_init();
                    };
                })(file);
                reader.readAsText(file);
            }
        });
        $("#gso_exportAllJSON").click(function () {
            var export_json = JSON.stringify(config);
            var blob = new Blob([export_json], {'type': 'application/json'});
            var dl_link = document.getElementById('gso_ruleset_export_dllink');
            dl_link.target = '_blank';
            dl_link.download = "config.json";
            dl_link.href = (window.URL || window.webkitURL).createObjectURL(blob);
            dl_link.click();
            dl_link.href = "#";
        });
        $("#gso_importAllJSON").change(function (event) {
            var file = event.target.files[0];
            /* MacではOKだが、Windowsだとfile.typeは空になる
               if(file.type != 'application/json' && file.type != 'text/plain') {
               return true; // continue
               }
            */
            var reader = new FileReader();
            reader.onload = (function(file) {        
                return function(evt) {
                    var config_json;
                    try {
                        config_json = JSON.parse(evt.target.result);
                    }
                    catch (e) {
                        console.log(e.message);
                        if (e instanceof SyntaxError) {
                            $("#gso_status").text('有効なJSONでないため、インポートに失敗しました。詳細はコンソールを参照してください。');
                            return;
                        }
                    }
                    if(check_config(config_json)) {
                        config = config_json;
                        gso_config_rseditor_init();
                    } else {
                        console.log(config_json);
                        $("#gso_status").text('不正な設定ファイルです。詳細はコンソールを参照してください。');
                    }
                };
            })(file);
            reader.readAsText(file);
        });
        $("#gso_resetAll").click(function () {
            var phase = Number($(this).attr('data-phase'));
            if (phase === 0) {
                $(this).text("後悔しませんね?");
                $(this).attr('data-phase', "1");
            } else if(phase >= 1) {
                GM_deleteValue("quick_block");
                GM_deleteValue("check_for_image");
                GM_deleteValue("ruleset_name_with_comment");
                GM_deleteValue("fix_missing");
                GM_deleteValue("hide_moshikashite");
                GM_deleteValue("force_keyword_exclusion_on_suggestion");
                GM_deleteValue("always_log_checked_entries");
                GM_deleteValue("float");
                GM_deleteValue("animation");
                GM_deleteValue("verbose");

                GM_deleteValue("rulesets");
                
                gso_load();
                gso_config_init();
                $("#gso_status").text('全ての設定を初期化しました。');
                $(this).text("全設定を初期化(元に戻せません!)");
                $(this).attr('data-phase', "0");
            }
        });
        
        $("#gso_ruleset_selectAll").click(function () {
            $("#gso_ruleset_table table tbody tr").addClass("gso_rule_selected");
            gso_rseditor_update_selection();
        });
        $("#gso_ruleset_unselectAll").click(function () {
            $("#gso_ruleset_table table tbody tr").removeClass("gso_rule_selected");
            gso_rseditor_update_selection();
        });
        $("#gso_ruleset_selectToggle").click(function () {
            $("#gso_ruleset_table table tbody tr").toggleClass("gso_rule_selected");
            gso_rseditor_update_selection();
        });
        $("#gso_rule_moveup").click(function () {
            var idx;
            if($("#gso_ruleset_table table tbody tr.gso_rule_selected").size() == 1) {
                idx = Number($("#gso_ruleset_table table tbody tr.gso_rule_selected").attr('data-idx'));
                if(idx - 1 >= 0) {
                    config.rulesets[$("#gso_ruleset_select").val()].rules.splice(
                        idx - 1, 2,
                        config.rulesets[$("#gso_ruleset_select").val()].rules[idx],
                        config.rulesets[$("#gso_ruleset_select").val()].rules[idx - 1]);
                    $("#gso_ruleset_select").change();
                    $("#gso_ruleset_table table tbody tr:eq(" + (idx-1) + ")").click();
                }
            }
        });
        $("#gso_rule_movedown").click(function () {
            var idx;
            if($("#gso_ruleset_table table tbody tr.gso_rule_selected").size() == 1) {
                idx = Number($("#gso_ruleset_table table tbody tr.gso_rule_selected").attr('data-idx'));
                if(idx + 1 <= config.rulesets[$("#gso_ruleset_select").val()].rules.length - 1) {
                    config.rulesets[$("#gso_ruleset_select").val()].rules.splice(
                        idx, 2,
                        config.rulesets[$("#gso_ruleset_select").val()].rules[idx + 1],
                        config.rulesets[$("#gso_ruleset_select").val()].rules[idx]);
                    $("#gso_ruleset_select").change();
                    $("#gso_ruleset_table table tbody tr:eq(" + (idx+1) + ")").click();
                }
            }
        });

        $("#gso_rule_add").click(function () {
            var new_rule = {
                "target": $("#gso_rule_target").val(),
                "type": $("#gso_rule_type").val(),
                "action": $("#gso_rule_action").val(),
                "level": Number($("#gso_rule_level").val()),
                "criteria": $("#gso_rule_criteria").val(),
                "comment": $("#gso_rule_comment").val(),
                "enabled": $("#gso_rule_enabled").prop("checked")
            };
            if(!check_rule(new_rule)) return;
            if($("#gso_ruleset_table table tbody tr.gso_rule_selected").size() == 1) {
                config.rulesets[$("#gso_ruleset_select").val()].rules.splice(
                    Number($("#gso_ruleset_table table tbody tr.gso_rule_selected:last").attr('data-idx')) + 1,
                    0,
                    new_rule);
            } else {
                config.rulesets[$("#gso_ruleset_select").val()].rules.push(new_rule);
            }
            $("#gso_ruleset_select").change();
        });
        $("#gso_rule_overwrite").click(function () {
            /* 入力チェックが必要 */
            var new_rule = null;
            if($("#gso_ruleset_table table tbody tr.gso_rule_selected").size() == 1) {
                new_rule = {
                    "target": $("#gso_rule_target").val(),
                    "type": $("#gso_rule_type").val(),
                    "action": $("#gso_rule_action").val(),
                    "level": Number($("#gso_rule_level").val()),
                    "criteria": $("#gso_rule_criteria").val(),
                    "comment": $("#gso_rule_comment").val(),
                    "enabled": $("#gso_rule_enabled").prop("checked")
                };
                if(!check_rule(new_rule)) return;
                var index = Number($("#gso_ruleset_table table tbody tr.gso_rule_selected:first")
                    .attr('data-idx'));
                config.rulesets[$("#gso_ruleset_select").val()].rules[index] = new_rule;
                $("#gso_ruleset_select").change();
            } else if($("#gso_ruleset_table table tbody tr.gso_rule_selected").size() > 1) {
                /* 複数選択 */
                $("#gso_ruleset_table table tbody tr.gso_rule_selected").each(function() {
                    new_rule = {
                        "target": $("#gso_rule_target").val(),
                        "type": $("#gso_rule_type").val(),
                        "action": $("#gso_rule_action").val(),
                        "level": Number($("#gso_rule_level").val()),
                        "criteria": $("#gso_rule_criteria").val(),
                        "comment": $("#gso_rule_comment").val(),
                        "enabled": $("#gso_rule_enabled").prop("checked")
                    };
                    var rule = config.rulesets[$("#gso_ruleset_select").val()].rules[Number($(this).attr('data-idx'))];
                    Object.keys(new_rule).forEach(function (k) {
                        if (new_rule[k] === "" || new_rule[k] === null) {
                            new_rule[k] = rule[k];
                        }
                    });
                    console.log(new_rule);
                    if(check_rule(new_rule)) {
                        config.rulesets[$("#gso_ruleset_select").val()].rules[Number($(this).attr('data-idx'))] = new_rule;
                    }
                });
                $("#gso_ruleset_select").change();
            }
        });
        $("#gso_rule_remove").click(function () {
            $("#gso_ruleset_table table tbody tr.gso_rule_selected").each(function() {
                var index = Number($(this).attr('data-idx'));
                delete config.rulesets[$("#gso_ruleset_select").val()].rules[index];
            });
            config.rulesets[$("#gso_ruleset_select").val()].rules =
                config.rulesets[$("#gso_ruleset_select").val()].rules.filter(function(e) {
                    return e !== undefined;
                });
            $("#gso_ruleset_select").change();
        });

        $("#gso_config_misc input").change(function() {
            config.config[$(this).val()] = $(this).prop("checked");
        });

        $("#gso_ruleset_editor_toggle").click(function() {
            if($("#gso_ruleset_editor").is(":visible")) {
                $("#gso_ruleset_editor_toggle").text("▼");
            } else {
                $("#gso_ruleset_editor_toggle").text("▲");
            }
            $("#gso_ruleset_editor").slideToggle();
        });
        $("#gso_log_toggle").click(function() {
            if($("#gso_log").is(":visible")) {
                $("#gso_log_toggle").text("▼");
            } else {
                $("#gso_log_toggle").text("▲");
            }
            $("#gso_log").slideToggle();
        });
        $("#gso_log_clear").click(function() {
            $("#gso_log_table tbody tr").remove();
        });
        $("#gso_ruleset_manager_toggle").click(function() {
            if($("#gso_ruleset_manager").is(":visible")) {
                $("#gso_ruleset_manager_toggle").text("▼");
            } else {
                $("#gso_ruleset_manager_toggle").text("▲");
            }
            $("#gso_ruleset_manager").slideToggle();
        });
        $("#gso_config_misc_toggle").click(function() {
            if($("#gso_config_misc").is(":visible")) {
                $(this).text("▼");
            } else {
                $(this).text("▲");
            }
            $("#gso_config_misc").slideToggle();
        });
        $("#gso_backup_toggle").click(function() {
            if($("#gso_backup").is(":visible")) {
                $(this).text("▼");
            } else {
                $(this).text("▲");
            }
            $("#gso_backup").slideToggle();
        });
        $("#gso_about_toggle").click(function() {
            if($("#gso_about").is(":visible")) {
                $(this).text("▼");
            } else {
                $(this).text("▲");
            }
            $("#gso_about").slideToggle();
        });

        $("#gso_save").click(function () {
            gso_save();
            $("#gso_status").text("設定を反映させるには再読み込みを行ってください");
        });

        $("#gso_revert").click(function () {
            gso_load();
            gso_config_init();
        });
        $(window).scroll(function () {
            /* 表示を追従させる */
            var ctl = $("#gso_control");
            var cfg = $("#gso_config");
            var minimum_top = 110;
            var minimum_top_cfg = 0;

            if(config.config.float) {
                if($(window).scrollTop() > minimum_top && ctl.hasClass("gso_control_embedded")) {
                    ctl.removeClass("gso_control_embedded");
                    ctl.addClass("gso_float");
                } else if($(window).scrollTop() <= minimum_top && cfg.hasClass("gso_float")) {
                    ctl.removeClass("gso_float");
                    ctl.addClass("gso_control_embedded");
                }
                if($(window).scrollTop() > minimum_top_cfg && cfg.hasClass("gso_config_embedded")) {
                    cfg.removeClass("gso_config_embedded");
                    cfg.addClass("gso_float");
                } else if($(window).scrollTop() <= minimum_top_cfg && cfg.hasClass("gso_float")) {
                    cfg.removeClass("gso_float");
                    cfg.addClass("gso_config_embedded");
                }
            } else {
                if(ctl.hasClass("gso_float")) {
                    ctl.removeClass("gso_float");
                    ctl.addClass("gso_control_embedded");
                }
                if(cfg.hasClass("gso_float")) {
                    cfg.removeClass("gso_float");
                    cfg.addClass("gso_config_embedded");
                }
            }
        });
        /* End of event handlers section */
    }
    /* Initialize Configuration */
    gso_config_init();
    $("#gso_ruleset_select").change();

    if($("#sbtc").size() > 0 || $("#search").size() > 0) {
        $("#gso_control").show();
    } else {
        $("#gso_control").hide();
    }
    
    var mo_autocomplete =
        new MutationObserver(function(mutationEventList){
            mutationEventList.forEach(function(mutationEvent) {
                var target = mutationEvent.target;
                if(target.id == "lst-ib" || target.id == "sbtc") {
                    check_autocomplete();
                }
            });
        });
    
    /* mo_serp: 検索結果を探す */
    var mo_serp = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            /* ノードが追加されたか？ */
            if (mutation.addedNodes && (mutation.addedNodes.length > 0)) {
                /* その中に 'div#search'があるか？ */
                var node_search = mutation.target.querySelector("div#search");
                if (!node_search) node_search = mutation.target.querySelector("div#rhs");
                /* 右側「他の人はこちらを検索」とか */
                if (node_search) {
                    /* 'div#search' が挿入された */
                    mo_serp.disconnect();

                    /* すでに存在する要素について直ちにチェック */
                    $(node_search).find(selector_KW).not("*.gso_checked").each( function() {
                        check_elem_kw(this);
                    });
                    if(location.href.search("&tbm=isch&") == -1){
                        $(node_search).find(selector_SERP).not("*.gso_checked").each( function() {
                            check_elem_serp(this);
                        });
                        $(node_search).find(selector_IMG).not("*.gso_checked").each( function() {
                            check_elem_img(this);
                        });
                    }
                    if(location.href.search("&tbm=isch&") >= 0 && config.config.check_for_image){
                        $(selector_IMGLIST).not("*.gso_checked").each(function() {
                            check_elem_imglist(this);
                        });
                    }
                    mo_link.observe(node_search, {childList: true, subtree: true});
                    mo_serp.observe(document.body, {childList: true, subtree: true});  
                }

                /* その中に 'div#topstuff'があるか？ */
                var node_topstuff = mutation.target.querySelector("div#topstuff");
                if (node_topstuff) {
                    /* 'div#topstuff' が挿入された */
                    mo_serp.disconnect();

                    /* すでに存在する要素について直ちにチェック */
                    $(node_topstuff).find(selector_KW).not("*.gso_checked").each( function() {
                        check_elem_kw(this);
                    });
                    hide_moshikashite();
                    mo_link.observe(node_topstuff, {childList: true, subtree: true});
                    mo_serp.observe(document.body, {childList: true, subtree: true});  
                }

                /* その中に 'div#taw'があるか？ */
                var node_taw = mutation.target.querySelector("div#taw");
                if (node_taw) {
                    /* 'div#taw' が挿入された */
                    mo_serp.disconnect();

                    /* すでに存在する要素について直ちにチェック */
                    $(node_taw).find(selector_KW).not("*.gso_checked").each( function() {
                        check_elem_kw(this);
                    });
                    hide_moshikashite();
                    mo_link.observe(node_taw, {childList: true, subtree: true});
                    mo_serp.observe(document.body, {childList: true, subtree: true});  
                }

                /* その中に 'div#extrares'があるか？ */
                var node_extrares = mutation.target.querySelector("div#extrares");
                if (node_extrares) {
                    /* 'div#extrares' が挿入された */
                    mo_serp.disconnect();

                    /* すでに存在する要素について直ちにチェック */
                    $(node_extrares).find(selector_KW).not("*.gso_checked").each( function() {
                        check_elem_kw(this);
                    });
                    mo_link.observe(node_extrares, {childList: true, subtree: true});
                    mo_serp.observe(document.body, {childList: true, subtree: true});  
                }
            }
        });
    });
    
    /* mo_link: ある要素の中に別の要素が挿入されたか監視 */
    var mo_link = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes) {
                [].slice.call(mutation.addedNodes).forEach(function(node) {
                    /* 最初に目に入る「関連キーワード」を最初に処理 */
                    $(node).find(selector_KW).not("*.gso_checked").each(function() {
                        check_elem_kw(this);
                    });
                    /* SERPを探して処理 */
                    if(location.href.search("&tbm=isch&") == -1){
                        $(node).find(selector_SERP).not("*.gso_checked").each(function() {
                            check_elem_serp(this);
                        });
                        $(node).find(selector_IMG).not("*.gso_checked").each(function() {
                            check_elem_img(this);
                        });
                    }
                    if(location.href.search("&tbm=isch&") >= 0 && config.config.check_for_image){
                        $(selector_IMGLIST).not("*.gso_checked").each(function() {
                            check_elem_imglist(this);
                        });
                    }
                    
                });
            }
        });
        hide_moshikashite();
    });

    $(document).ready(check_elem_first());

    /* div#searchの挿入を監視 */
    mo_serp.observe(document.body, {childList: true, subtree: true});    
    
    /* オートコンプリートの監視 */
    mo_autocomplete.observe(document.getElementById("sbtc"),
                            {attributes: true, childList: true, characterData: true, subtree: false});
    
    function check_elem_serp(node) {
        /* ---------- 検索結果 ---------- */
        if(!$(node).is(".gso_checked")) {
            /* ここでは検索して状況を記録するのみ
               書式の変更はまだ行わない */
            /* 各SERP(node)の状況を格納するオブジェクト */
            var context =
                {"element": $(node),
                 "title": null,
                 "target": null,
                 "description": null,
                 "matched_rules": null
                };
            var link = $(node).find("a:not(._T6c, .top, .ab_button, .fl)");
            if(link.size() === 0){
                link = $(node);
            }
            /* 状況記録部分 */
            /* ページのタイトル
               (実際のものからGoogleにより改竄される場合あり) */
            context.title = link.text();
            /* ページのURL */
            context.target = link.attr("href");

            /* ページの説明文または煽り文句 */
            try {
                context.description = $(node).find("span.st, div.st").text();
            }
            catch (e) {
                if (e instanceof TypeError) {
                    context.description = null;
                }
            }
            /* ルールに合致しているかチェック */
            context.matched_rules = check(context.target, context.description, context.title, null, null);
            if(context.matched_rules.length > 0) {
                var applied_rule = get_most_significant_rule(context.matched_rules);
                var ruleset_name = config.rulesets[applied_rule.ruleset_id].name;
                var original_desc = $(node).find("span.st, div.st");
                var new_desc = original_desc.clone();
                var msg = "";

                context.matched_rules.forEach(function(element, index, array) {
                    element.forEach(function (e) {
                        gso_log_append("page",
                                       e.rule.target,
                                       e.matched,
                                       context.title,
                                       context.target,
                                       e.ruleset_id,
                                       e.rule.action,
                                       applied_rule.rule.action,
                                       !(e.effective !== undefined && e.effective));
                    });
                });
                if(applied_rule.rule.action == "hide") {
                    $(node).hide();
                    $(node).find("div._S6c").insertAfter($(node)); /* 「詳細を見る」を外に出す */
                    if(applied_rule.rule.comment !== "" &&
                       !applied_rule.rule.comment.startsWith("#") &&
                       config.config.ruleset_name_with_comment) {
                        msg = ruleset_name + " [" + applied_rule.rule.comment + "]";
                    } else {
                        msg = ruleset_name;
                    }

                    if($(node).is("a")) {
                        $(node).replaceWith('<span class="gso_killed_serp_msg gso_killed_serp gso_serp_description_b gso_ani">'+
                                            msg +': ' +
                                            '<span class="gso_killed_url">' +
                                            applied_rule.matched + '</span>' +
                                            '</span>');
                    } else {
                        $(node).html('<span class="gso_killed_serp_msg">'+ msg +': ' +
                                     '<span class="gso_killed_url">' +
                                     applied_rule.matched + '</span>' +
                                     '</span>');
                        $(node).addClass("gso_killed_serp gso_serp_description_b gso_ani");
                    }

                } else if(applied_rule.rule.action == "hide_absolutely") {
                    $(node).hide();
                    $(node).find("div._S6c").insertAfter($(node)); /* 「詳細を見る」を外に出す */
                    if(applied_rule.rule.comment !== "" &&
                       !applied_rule.rule.comment.startsWith("#") &&
                       config.config.ruleset_name_with_comment) {
                        msg = ruleset_name + " [" + applied_rule.rule.comment + "]";
                    } else {
                        msg = ruleset_name;
                    }

                    if($(node).is("a")) {
                        $(node).replaceWith('<span class="gso_killed_serp_msg">'+ msg +
                                            '</span>');
                    } else {
                        $(node).html('<span class="gso_killed_serp_msg">'+ msg +
                                     '</span>');
                    }
                    $(node).addClass("gso_killed_serp gso_serp_description_b gso_ani");

                } else if(applied_rule.rule.action == "hide_description") {
                    new_desc.addClass("gso_serp_description_info gso_serp_description_a");
                    if(applied_rule.rule.comment !== "" &&
                       !applied_rule.rule.comment.startsWith("#") &&
                       config.config.ruleset_name_with_comment) {
                        new_desc.text(ruleset_name + " [" + applied_rule.rule.comment + "]");
                    } else {
                        new_desc.text(ruleset_name);
                    }
                    new_desc.insertAfter(original_desc);
                    original_desc.addClass("gso_serp_description_b gso_ani");
                    original_desc.hide();
                    $(node).addClass("gso_titleonly_serp");
                } else if(applied_rule.rule.action == "hide_description_warn") {
                    new_desc.addClass("gso_serp_description_warning gso_serp_description_a");
                    if(applied_rule.rule.comment !== "" &&
                       !applied_rule.rule.comment.startsWith("#") &&
                       config.config.ruleset_name_with_comment) {
                        new_desc.html("&#x26A0; " + ruleset_name + " [" + applied_rule.rule.comment + "]");
                    } else {
                        new_desc.html("&#x26A0; " + ruleset_name);
                    }
                    new_desc.insertBefore(original_desc);
                    original_desc.addClass("gso_serp_description_b gso_ani");
                    original_desc.hide();
                    $(node).addClass("gso_titleonly_serp");
                } else if(applied_rule.rule.action == "warn") {
                    new_desc.addClass("gso_serp_description_warning");
                    if(applied_rule.rule.comment !== "" &&
                       !applied_rule.rule.comment.startsWith("#") &&
                       config.config.ruleset_name_with_comment) {
                        new_desc.html("&#x26A0; " + ruleset_name + " [" + applied_rule.rule.comment + "]");
                    } else {
                        new_desc.html("&#x26A0; " + ruleset_name);
                    }
                    new_desc.insertBefore(original_desc);
                    $(node).addClass("gso_titleonly_serp");
                } else if(applied_rule.rule.action == "info") {
                    new_desc.addClass("gso_serp_description_info");
                    if(applied_rule.rule.comment !== "" &&
                       !applied_rule.rule.comment.startsWith("#") &&
                       config.config.ruleset_name_with_comment) {
                        new_desc.text(ruleset_name + " [" + applied_rule.rule.comment + "]");
                    } else {
                        new_desc.text(ruleset_name);
                    }
                    new_desc.insertBefore(original_desc);
                }
            } else if(config.config.always_log_checked_entries) {
                gso_log_append("page",
                               null,
                               null,
                               context.title,
                               context.target,
                               null,
                               "allow",
                               "allow",
                               true);
            }
            /* ---------- 「未指定：○○○」を処理 ---------- */
            if(config.config.fix_missing) {
                $(node).find("div._Tib:has(s)").each(function() {
                    var missing_kw_list = $(this);
                    var missing_kw_list_ar = [];
                    var missing_kw_list_new_html = missing_kw_list.html()
                        .replace(/<span>未指定:<\/span>/gi, "無視されたキーワード:")
                        .replace(/<span>Missing:<\/span>/gi, "Ignored keywords:")
                        .replace(/<s>/gi, '<span class="gso_ignored_kw">')
                        .replace(/<\/s>/gi, "</span>");
                    missing_kw_list.html(missing_kw_list_new_html);
                    
                    var new_url_all = decodeURI_s(location.href.replace(/&start=\d+/, ""));
                    missing_kw_list.children("span.gso_ignored_kw").each(function () {
                        var ignored_kw = $(this).text();
                        var re = new RegExp(escapeRegexp(ignored_kw), "gi");
                        var new_url = decodeURI_s(location.href)
                            .replace(/&start=\d+/, "")
                            .replace(re, '"' + ignored_kw + '"');
                        new_url_all = new_url_all.replace(re, '"' + ignored_kw + '"');
                        $(this).html('<a href="' + encodeURI(new_url) + '">' + ignored_kw + '</a>');
                        missing_kw_list_ar.push(ignored_kw);
                    });
                    gso_log_append("missing",
                                   null,
                                   missing_kw_list_ar.join(" "),
                                   context.title,
                                   context.target,
                                   null,
                                   null,
                                   null,
                                   false);
                    if(missing_kw_list.children("span.gso_ignored_kw").size() > 1) {
                        missing_kw_list.append(' <a href="' + encodeURI(new_url_all) + '">全部含めて再検索</a>');
                    }
                });
            }
            if(config.config.quick_block && !$(node).is("a")) {
                $(node).find("div._SWb").append("<span class='gso_quick_block' style='display: none;'>ブロック<button type='button' class='gso_control_buttons'>URL</button><button type='button' class='gso_control_buttons'>ドメイン</button></span>");
                var qb = $(node).find("span.gso_quick_block > button:eq(0)");
                var qb2 = $(node).find("span.gso_quick_block > button:eq(1)");
                var domain = "";
                qb.attr("data-target", context.target);
                qb.click(function () {
                    $("#gso_rule_target").val("url");
                    $("#gso_rule_type").val("str_head");
                    $("#gso_rule_action").val("hide");
                    $("#gso_rule_criteria").val($(this).attr("data-target"));
                    $("#gso_rule_comment").val("");
                    $("#gso_rule_enabled").prop("checked", true);
                    $("#gso_config").show();
                });
                try {
                    domain = context.target.split("/")[2].split(":")[0];
                }
                catch (e) {
                    domain = "";
                }
                qb2.attr("data-domain", domain);
                qb2.click(function () {
                    if($(this).attr("data-domain") !== "") {
                        $("#gso_rule_target").val("url");
                        $("#gso_rule_type").val("domain");
                        $("#gso_rule_action").val("hide");
                        $("#gso_rule_criteria").val($(this).attr("data-domain"));
                        $("#gso_rule_comment").val("");
                        $("#gso_rule_enabled").prop("checked", true);
                        $("#gso_config").show();
                    }
                });
                $(node).hover(
                    function () {
                        /* IN */
                        $(this).find("*.gso_quick_block").show();
                    },
                    function () {
                        /* OUT */
                        $(this).find("*.gso_quick_block").hide();
                    }
                );
            }
        }
        $(node).addClass("gso_checked");
        
        gso_log_setBoundary();
        update_gso_control_msg();
        update_serp();

    }
    function check_elem_img(node) {
        /* ---------- 検索結果に現れる画像 ---------- */
        if(!$(node).is(".gso_checked")) {
            var context =
                {"element": $(node),
                 "target": null,
                 "description": null,
                 "from": null,
                 "matched_rules": null
                };
            var link;
            if ($(node).is("a")) {
                link = $(node);
            } else {
                link = $(node).find("a:first");
            }
            if(link.size() > 0) {
                /* 状況記録部分 */
                if(link.hasClass("uh_rl")) {
                    /* ***の画像検索結果 */
                    // ページのURL
                    context.target = link.find("img:first").attr("title");
                    // 代替テキスト
                    context.description = link.find("img:first").attr("alt"); 
                }
                context.matched_rules = check(context.target, context.description, null, null, null);
                
                if(context.matched_rules.length > 0) {
                    var applied_rule = get_most_significant_rule(context.matched_rules);
                    var ruleset_name = config.rulesets[applied_rule.ruleset_id].name;

                    var msg = "";

                    context.matched_rules.forEach(function(element, index, array) {
                        element.forEach(function (e) {
                            gso_log_append("img",
                                           e.rule.target,
                                           e.matched,
                                           null,
                                           context.target,
                                           e.ruleset_id,
                                           e.rule.action,
                                           applied_rule.rule.action,
                                           !(e.effective !== undefined && e.effective));
                        });
                    });


                    if(applied_rule.rule.comment !== "" &&
                       !applied_rule.rule.comment.startsWith("#") &&
                       config.config.ruleset_name_with_comment) {
                        msg = ruleset_name + " [" + applied_rule.rule.comment + "]";
                    } else {
                        msg = ruleset_name;
                    }

                    if(applied_rule.rule.action != "allow" &&
                       applied_rule.rule.action != "hide_description" &&
                       applied_rule.rule.action != "info") {
                        $(node).addClass("gso_killed_serpimg");
                        $(node).append('<div class="gso_killed_serpimg_warn gso_killed_img_mask_serp"></div>');
                        if(applied_rule.rule.action == "hide") {
                            $(node).find("*.gso_killed_serpimg_warn").css("opacity", "0.8");
                            $(node).find("*.gso_killed_serpimg_warn").html("&#x26A0; " + msg);
                            $(node).append('<div class="gso_killed_serpimg_warn gso_killed_img_mask_serp gso_serp_description_a"></div>');
                        }
                        if(applied_rule.rule.action == "hide_description_warn" ||
                           applied_rule.rule.action == "warn") {
                            $(node).find("*.gso_killed_serpimg_warn").addClass("gso_serp_description_a");
                            $(node).find("*.gso_killed_serpimg_warn").css("opacity", "0.8");
                            $(node).find("*.gso_killed_serpimg_warn").html("&#x26A0; " + msg);
                        }
                        if(applied_rule.rule.action == "hide_absolutely") {
                            $(node).find("*.gso_killed_serpimg_warn").css("opacity", "1");
                        }
                    }
                } else if(config.config.always_log_checked_entries) {
                    gso_log_append("img",
                                   null,
                                   null,
                                   null,
                                   context.target,
                                   null,
                                   "allow",
                                   "allow",
                                   true);
                }
            }
            $(node).addClass("gso_checked");
            gso_log_setBoundary();
            update_gso_control_msg();
        }
        update_img();
    }
    function check_elem_imglist(node) {
        /* ---------- 画像検索 ---------- */
        if(!$(node).is(".gso_checked")) {
            var context =
                {"element": $(node),
                 "title": null,
                 "target": null,
                 "imgsrc": null,
                 "description": null,
                 "from": null,
                 "matched_rules_target": null,
                 "matched_rules_imgsrc": null
                };
            /* 状況記録部分 */
            var link = $(node).find("a.rg_l");
            /* console.log($(node).find("a.rg_l")[0].href)
               では、なぜか undefined が返される */
            var metadata = null;
            /* $(SELECTOR_IMGLIST) 直下の div.rg_meta (非表示)に
               画像のメタデータがJSON形式で格納されている */
            try {
                metadata = JSON.parse($(node).find("div.rg_meta").text());
                context.title = metadata.pt;
                context.description = metadata.s;
                context.from = metadata.isu;
                context.target = metadata.ru;
                context.imgsrc = metadata.ou;
            }
            catch (e) {
                /* bad metadata */
                context.title = null;
                context.description = null;
                context.from = null;
            }
            if(link.size() > 0) {
                context.matched_rules_target = check(context.target, context.description, context.title, null, null);
                context.matched_rules_imgsrc = check(context.imgsrc, null, null, null, null);
                var matched_rules = context.matched_rules_target.concat(context.matched_rules_imgsrc);

                if(matched_rules.length > 0) {
                    var applied_rule = get_most_significant_rule(matched_rules);
                    var ruleset_name = config.rulesets[applied_rule.ruleset_id].name;

                    var msg = "";
                    matched_rules.forEach(function(element, index, array) {
                        element.forEach(function (e) {
                            gso_log_append("img",
                                           e.rule.target,
                                           e.matched,
                                           context.title,
                                           context.target,
                                           e.ruleset_id,
                                           e.rule.action,
                                           applied_rule.rule.action,
                                           !(e.effective !== undefined && e.effective));
                        });

                    });

                    if(applied_rule.rule.comment !== "" &&
                       !applied_rule.rule.comment.startsWith("#") &&
                       config.config.ruleset_name_with_comment) {
                        msg = ruleset_name + " [" + applied_rule.rule.comment + "]";
                    } else {
                        msg = ruleset_name;
                    }

                    if(applied_rule.rule.action == "hide" ||
                       applied_rule.rule.action == "hide_description_warn" ||
                       applied_rule.rule.action == "warn" ||
                       applied_rule.rule.action == "hide_absolutely"
                      ) {
                        $(node).addClass("gso_killed_serpimg");
                        $(node).append('<div class="gso_killed_serpimg_warn gso_killed_img_mask_isch"></div>');

                        if(applied_rule.rule.action == "hide") {
                            $(node).find("*.gso_killed_serpimg_warn").css("opacity", "0.8");
                            $(node).find("*.gso_killed_serpimg_warn").html("&#x26A0; " + msg);
                            $(node).append('<div class="gso_killed_serpimg_warn gso_killed_img_mask_isch gso_serp_description_a"></div>');
                        }
                        if(applied_rule.rule.action == "hide_description_warn" ||
                           applied_rule.rule.action == "warn") {
                            $(node).find("*.gso_killed_serpimg_warn").css("opacity", "0.8");
                            $(node).find("*.gso_killed_serpimg_warn").html("&#x26A0; " + msg);
                            $(node).find("*.gso_killed_serpimg_warn").addClass("gso_serp_description_a");
                        }
                        if(applied_rule.rule.action == "hide_absolutely") {
                            $(node).find("*.gso_killed_serpimg_warn").css("opacity", "1");
                        }
                    }
                } else if(config.config.always_log_checked_entries) {
                    gso_log_append("img",
                                   null,
                                   null,
                                   context.title,
                                   context.target,
                                   null,
                                   "allow",
                                   "allow",
                                   true);
                }
            }
            $(node).addClass("gso_checked");
            gso_log_setBoundary();
        }
        update_gso_control_msg();
    }
    function check_elem_kw(node) {
        /* ---------- 関連語句 ----------  */
        if(!$(node).is(".gso_checked")) {
            $(node).addClass("gso_checked");
            var context =
                {
                    "related_kw": $(node).text(),
                    "matched_rules": null
                };
            context.matched_rules = check(null, null, null, context.related_kw, null);
            
            if(context.matched_rules.length > 0) {
                var applied_rule = get_most_significant_rule(context.matched_rules);
                context.matched_rules.forEach(function(element, index, array) {
                    element.forEach(function (e) {
                        gso_log_append("suggest",
                                       null,
                                       e.matched,
                                       context.related_kw,
                                       null,
                                       e.ruleset_id,
                                       e.rule.action,
                                       applied_rule.rule.action,
                                       !(e.effective !== undefined && e.effective));
                    });
                });
                if(applied_rule.rule.action == "hide") {
                    $(node).replaceWith('<span class="gso_killed_kw">' +
                                        '<span class="gso_killed_kw_bad gso_serp_description_b">' +
                                        context.related_kw +
                                        ' <span style="background-color: silver; color: dimgray;" title="' +
                                        config.rulesets[applied_rule.ruleset_id].name + '">×</span>' +
                                        '</span>' +
                                        '<span class="gso_serp_description_a" style="opacity: 0;">***</span></span>');
                } else if(applied_rule.rule.action == "warn") {
                    $(node).after(' <span style="background-color: silver; color: dimgray;" title="' +
                                        config.rulesets[applied_rule.ruleset_id].name + '">&#x26A0;</span>');
                } else if(applied_rule.rule.action == "hide_absolutely") {
                    $(node).replaceWith('<span class="gso_killed_kw">' +
                                        '<span class="gso_killed_kw_bad gso_serp_description_a" style="opacity: 0;">***</span>' +
                                        '<span class="gso_killed_kw_placeholder gso_killed_kw_bad gso_serp_description_b">' +
                                        config.rulesets[applied_rule.ruleset_id].name +
                                        '</span></span>');
                }
                gso_log_setBoundary();
                update_kw();
                update_gso_control_msg();
                return (applied_rule.rule.action != "allow");
            } else if(config.config.always_log_checked_entries) {
                gso_log_append("suggest",
                               null,
                               null,
                               context.related_kw,
                               null,
                               null,
                               "allow",
                               "allow",
                               true);
            }
            if(config.config.force_keyword_exclusion_on_suggestion) {
                var keywords = [];
                var params_raw = "";
                var params = {};
                var temp_rulesets = {
                    "MINUS": {
                        "name": "マイナス検索による除外",
                        "enabled": true,
                        "rules": []
                    }
                };

                if(location.href.search("#") >= 0) {
                    params_raw = location.href.split("#")[1];
                    params_raw.split("&").forEach(function(element, index, array) {
                        params[element.split("=")[0]] = element.split("=")[1];
                    });
                } else {
                    params_raw = location.href.split("?")[1];
                    params_raw.split("&").forEach(function(element, index, array) {
                        params[element.split("=")[0]] = element.split("=")[1];
                    });
                }
                if(params.q !== undefined) {
                    keywords = params.q.split("+").filter(function(element) {
                        return element.startsWith("-");
                    });
                }
                keywords.forEach(function(element) {
                    temp_rulesets.MINUS.rules.push({
                        "target": "suggest",
                        "type": "word",
                        "action": "hide",
                        "level": 0,
                        "criteria": decodeURI_s(element.substr(1)),
                        "comment": "",
                        "enabled": true
                    });
                });
                var matched_rules_exclusion = check(null, null, null, context.related_kw, temp_rulesets);
                matched_rules_exclusion.forEach(function(element, index, array) {
                    element.forEach(function (e) {
                        gso_log_append("suggest_excl",
                                       null,
                                       e.matched,
                                       context.related_kw,
                                       null,
                                       null,
                                       e.rule.action,
                                       e.rule.action,
                                       false);
                    });
                });
                if(matched_rules_exclusion.length > 0) {
                    gso_log_setBoundary();
                    $(node).hide();
                }
            }
        } else {
            return false;
        }
    }
    
    function check_autocomplete() {
        /* 検索語句入力欄のオートコンプリートをチェック
           (関連語句のみ) */
        mo_autocomplete.disconnect();
        $("#sbtc li.gsfs").each(function() {
            
            var context =
                {
                    "autocomplete" : $(this).find("div.sbqs_c").text(),
                    "matched_rules": null
                }; 
            context.matched_rules = check(null, null, null, context.autocomplete, null);

            if(context.matched_rules.length > 0) {
                var applied_rule = get_most_significant_rule(context.matched_rules);
                context.matched_rules.forEach(function(element, index, array) {
                    element.forEach(function (e) {
                        gso_log_append("autocomplete",
                                       null,
                                       e.matched,
                                       context.autocomplete,
                                       null,
                                       e.ruleset_id,
                                       e.rule.action,
                                       applied_rule.rule.action,
                                       !(e.effective !== undefined && e.effective));
                    });
                });
                if(applied_rule.rule.action != "allow") {
                    $(this).addClass("gso_killed_kw_autocomplete");
                    $("#gso_results_msg_eff").show().fadeOut("slow");
                } else {
                    $(this).removeClass("gso_killed_kw_autocomplete");
                }
            } else {
                $(this).removeClass("gso_killed_kw_autocomplete");
            }
        });
        gso_log_setBoundary();
        
        mo_autocomplete.observe(document.getElementById("sbtc"),
                                {attributes: true, childList: true, characterData: true, subtree: true});
        
    }
    
    function update_serp() {
        if(status.show_serp) {
            $("*.gso_serp_description_a:not(*.gso_ani,*.gso_killed_kw_bad,*.gso_killed_kw_placeholder,*.gso_killed_serpimg_warn)").hide();
            $("*.gso_serp_description_b:not(*.gso_ani,*.gso_killed_kw_bad,*.gso_killed_kw_placeholder,*.gso_killed_serpimg_warn)").show();
            $("*.gso_serp_description_a.gso_ani:not(*.gso_killed_kw_bad,*.gso_killed_kw_placeholder,*.gso_killed_serpimg_warn)").slideUp("fast");
            $("*.gso_serp_description_b.gso_ani:not(*.gso_killed_kw_bad,*.gso_killed_kw_placeholder,*.gso_killed_serpimg_warn)").slideDown("fast");
        } else {
            $("*.gso_serp_description_a:not(*.gso_ani,*.gso_killed_kw_bad,*.gso_killed_kw_placeholder,*.gso_killed_serpimg_warn)").show();
            $("*.gso_serp_description_b:not(*.gso_ani,*.gso_killed_kw_bad,*.gso_killed_kw_placeholder,*.gso_killed_serpimg_warn)").hide();
            $("*.gso_serp_description_a.gso_ani:not(*.gso_killed_kw_bad,*.gso_killed_kw_placeholder,*.gso_killed_serpimg_warn)").slideDown("fast");
            $("*.gso_serp_description_b.gso_ani:not(*.gso_killed_kw_bad,*.gso_killed_kw_placeholder,*.gso_killed_serpimg_warn)").slideUp("fast");
        }
    }
    function update_img() {
        if(status.show_img) {
            $("*.gso_killed_serpimg_warn.gso_serp_description_b").show();
            $("*.gso_killed_serpimg_warn.gso_serp_description_a").hide();
        } else {
            $("*.gso_killed_serpimg_warn.gso_serp_description_a").show();
            $("*.gso_killed_serpimg_warn.gso_serp_description_b").hide();
        }
        /* slideToggle ではなんかバグる */
    }
    function update_kw() {
        if(status.show_kw) {
            $("span.gso_killed_kw span.gso_serp_description_a").hide();
            $("span.gso_killed_kw span.gso_serp_description_b").show();
        } else {
            $("span.gso_killed_kw span.gso_serp_description_a").show();
            $("span.gso_killed_kw span.gso_serp_description_b").hide();
        }
    }

    function update_gso_control_msg() {
        /* 結果表示 */
        var count_totalSERP = $("*.gso_killed_serp").size();
        var count_totalSERPdesc = $("*.gso_titleonly_serp").size();
        var count_totalSERPimg = $("*.gso_killed_serpimg").size();
        var count_totalKW = $("*.gso_killed_kw").size();
        var count_totalIK = $("span.gso_ignored_kw:visible").size();

        $("#gso_killed_count_s").html("検索結果: " + (count_totalSERP + count_totalSERPdesc));
        $("#gso_killed_count_si").html("画像: " + count_totalSERPimg);
        $("#gso_killed_count_k").html("関連語句: " + count_totalKW);

        if(count_totalSERP > 0 || count_totalSERPdesc > 0) {
            $("#gso_killed_count_s").parent().show();
        } else {
            $("#gso_killed_count_s").parent().hide();
        }
        if(count_totalSERPimg > 0) {
            $("#gso_killed_count_si").parent().show();
        } else {
            $("#gso_killed_count_si").parent().hide();
        }
        if(count_totalKW > 0) {
            $("#gso_killed_count_k").parent().show();
        } else {
            $("#gso_killed_count_k").parent().hide();
        }
        if(count_totalIK > 0) {
            $("#gso_count_ik").html("検索語句無視! [" + count_totalIK + "]<br>" +
                                    "<a href='" + location.href + "&tbs=li:1'>完全一致で再検索</a>");
            $("#gso_count_ik").show();
        } else {
            $("#gso_count_ik").hide();
        }
        if(count_totalSERP > 0 ||
           count_totalSERPdesc > 0 ||
           count_totalSERPimg > 0 ||
           count_totalKW > 0) {
            $("#gso_results_msg_top").html("検索結果を処理済<br>(クリックで切替)");
        } else if(count_totalIK > 0) {
            $("#gso_results_msg_top").html("検索結果を処理済");
        } else {
            $("#gso_results_msg_top").html("検索結果に問題なし");
        }
    }

    function hide_moshikashite() {
        if(config.config.hide_moshikashite && $("p.ssp").size() > 0 && location.href.match("start=") !== null) {
            $("p.ssp").hide();
        }
    }
    function check_elem_first() {
        check_elem_all();
    }

    function check_elem_all() {
        var count_SERP = 0; /* ブラックリストに該当したサイトの数 */
        var count_SERPimg = 0; /* ブラックリストに該当した画像の数 */
        var count_KW = 0; /* ブラックリストに該当した関連KWの数 */
        
        if(location.href.search("&tbm=isch&") == -1){
            $(selector_SERP).not("*.gso_checked").each(function () {
                check_elem_serp(this);
            });
            
            count_SERP = $("*.gso_killed_serp").size();

            /* ---------- 画像検索結果(リンク外す) ---------- */
            /* 隠す対象となりうる要素 */
            var entries = $(selector_IMG).not("*.gso_checked");
            entries.each(function() {
                check_elem_img(this);
            });
            
            count_SERPimg = $("*.gso_killed_serpimg").size();
        }
        /* ---------- 関連キーワード ---------- */
        
        /* top: div#trev > div > a.nobr
           bottom: div.brs_col > p._e4b > a */

        $(selector_KW).not("*.gso_checked").each(function() {
            if(check_elem_kw(this)) count_KW++;
        });

        /* ---------- [画像]モードの検索結果 ---------- */
        if(location.href.search("&tbm=isch&") >= 0 && config.config.check_for_image){
            $(selector_IMGLIST).not("*.gso_checked").each(function() {
                check_elem_imglist(this);
            });
        }
        hide_moshikashite();
    }
    
    
})();
