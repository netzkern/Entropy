// ==UserScript==
// @name         TFS Pull Request improvements
// @namespace    de.netzkern
// @version      1.2.0
// @description  Some TFS improvements.
// @author       Florian Koch . netzkern
// @match        *://backlog.netzkern.de/tfs/*/pullrequest*
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @require      https://cdnjs.cloudflare.com/ajax/libs/remarkable/1.6.2/remarkable.min.js
// @resource     mdCSS https://sindresorhus.com/github-markdown-css/github-markdown.css
// ==/UserScript==
/* jshint -W097 */
'use strict';

// changelog:
// 1.2.0 - Work item information
// 1.1.0 - markdown support
// 1.0.2 - removed blue border on PRs where user was added but you have not voted yet.
// 1.0.1 - removed console.log... :)
// 1.0.0 - show PR info on overview page.

var mdCSS = GM_getResourceText("mdCSS");
GM_addStyle (mdCSS);

// CSS styling
GM_addStyle ( "                                             \
    .vc-pullrequest-entry.reviewed {                        \
        outline: 1px solid #007acc;                         \
    }                                                       \
    .reviewer-image {                                       \
        margin: 2px;                                        \
        width: 20px;                                        \
        height: 20px;                                       \
        outline: 2px solid transparent;                     \
    }                                                       \
    .reviewer-image.me {                                    \
        /*outline: 2px solid #007acc;*/                     \
    }                                                       \
    .merge {                                                \
        color: #0a0;                                        \
        font-weight: bold;                                  \
    }                                                       \
    .merge.failed {                                         \
        color: red;                                         \
    }                                                       \
    .status {                                               \
        font-weight: bold;                                  \
    }                                                       \
    .status.pos {                                           \
        color: #0a0;                                        \
    }                                                       \
    .status.neg {                                           \
        color: red;                                         \
    }                                                       \
                                                            \
    .markdown-body {                                        \
        font-size: inherit;                                 \
        line-height: inherit;                               \
        color: black;                                       \
        font-family: inherit;                               \
    }                                                       \
    .markdown-body ul, .markdown-body ol {                  \
        font-size: 0;                                       \
    }                                                       \
    .markdown-body li {                                     \
        font-size: 12px;                                    \
    }                                                       \
    .workitem-description-details {                         \
        height: 50px;                                       \
        overflow: hidden;                                   \
        position: relative;                                 \
        padding-bottom: 18px;                               \
    }                                                       \
    .workitem-description-details:after {                   \
        content: '... hover for more details';              \
        display: block;                                     \
        position: absolute;                                 \
        bottom: 0px;                                        \
        height: 14px;                                       \
        width: 100%;                                        \
        padding-top: 4px;                                   \
        background: white;                                  \
    }                                                       \
    .workitem-description-details:hover {                   \
        height: auto;                                       \
    }                                                       \
    .workitem-description-details:hover:after {             \
        display: none;                                      \
    }                                                       \
    .work-item-summary table {                              \
        border-collapse: separate;                          \
        border-spacing: 5px;                                \
    }                                                       \
    .vc-pullrequest-work-items-container:not(:last-child) { \
        border-bottom: 1px solid lightgrey;                 \
     }                                                      \
" );

var currentIdentity;
var $rightPane;
var $prEntries;
var prDesc;
var workItemsData;
var md = new Remarkable();

function renderPrInfo(line, data) {
    if(data && data.reviewers && data.reviewers.length) {
        var iReviewed = false;
        var reviewers = '';
        //console.log(line, data);
        var score = 0;
        for(var revI = 0, revLen = data.reviewers.length; revI<revLen; revI++) {
            var reviewer = data.reviewers[revI];
            if(reviewer.id == currentIdentity.id && reviewer.vote !== 0) {
                iReviewed = true;
            }
            score += reviewer.vote;
            reviewers += '<img class="reviewer-image' + (iReviewed ? ' me' : '') + '" title="' + reviewer.displayName + '" src="' + reviewer.imageUrl + '" />';
        }

        var $prTitle = $prEntries.find('.vc-pullrequest-entry-title[href*="/' + data.pullRequestId + '#"]');
        var $pr = $prTitle.closest('.vc-pullrequest-entry');
        if(iReviewed) {
            $pr.addClass('reviewed');
        }
        var prReviewers = '<td rowspan="2">reviewers:<br>' + reviewers + '</td>';
        $prTitle.parent().removeAttr('colspan').after(prReviewers);

        var scoreClass = '';
        if(score > 0) {
            scoreClass = 'pos';
        }
        if(score < 0) {
            scoreClass = 'neg';
        }
        $prTitle.after(' (<span class="merge ' + (data.mergeStatus != 'succeeded' ? 'failed' : '') + '" title="merge: ' + data.mergeStatus + '">merge</span>) (<span class="status ' + scoreClass + '" title="score: ' + score + '">status</span>)');
    }
}

function showPrInfo(response) {
    if(!TFS || !TFS.DataServices || !TFS.DataServices.tfsContext || !TFS.DataServices.tfsContext.currentIdentity) {
        return;
    }
    currentIdentity = TFS.DataServices.tfsContext.currentIdentity;
    if(response.count) {
        for(var i=0, len = response.count; i<len; i++) {
            (function(responseLineIndex, response) {
                var responseLine = response.value[i];
                if(responseLine.createdBy && responseLine.createdBy.id && responseLine.createdBy.id == currentIdentity.id) {
                    //continue; // skip my own PR
                }
                $.get(responseLine.url).then(function(data) {
                    renderPrInfo(responseLineIndex, data);
                });
            })(i, response);
        }
    }
}

function renderMarkdown() {
    if(prDesc) {
        var $desc = $('.vc-pullrequest-entry-details-description');
        if(!$desc.hasClass('markdown-body')) {
            $desc.addClass('markdown-body');
        }
        $desc.html(md.render(prDesc));
    }
}

function parseParams(str) {
    return str.split('&').reduce(function (params, param) {
        var paramSplit = param.split('=').map(function (value) {
            return decodeURIComponent(value.replace('+', ' '));
        });
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
}

function tableWrap(key, val, disableHhtmlEncode) {
    if(val) {
        if(!disableHhtmlEncode) {
            val = val.toHtmlEntities();
        }
        return '<tr><td>' + key + ':</td><td>'
            + val
            + '</td></tr>';
    }
    return '';
}

/**
 * Convert a string to HTML entities
 */
String.prototype.toHtmlEntities = function() {
    return this.replace(/./gm, function(s) {
        return "&#" + s.charCodeAt(0) + ";";
    });
};

/**
 * Create string from HTML entities
 */
String.fromHtmlEntities = function(string) {
    return (string+"").replace(/&#\d+;/gm,function(s) {
        return String.fromCharCode(s.match(/\d+/gm)[0]);
    })
};

function renderWorkItemsDetails() {
    if(workItemsData && workItemsData.length) {
        $('.vc-pullrequest-work-items-container').each(function(index) {
            var $this = $(this);
            var workItemData = workItemsData[index];
            //console.log(workItemData);
            var $url = $this.find('[data-bind="text: $data.itemId, attr: {href: $data.url}"]');
            var $title = $this.find('[data-bind="text: $data.title"]');
            var $status = $this.find('[data-bind="text: $data.fullStatus"]');
            var href = $url.attr('href');
            href = href.substring(0, href.lastIndexOf('/'));
            href += '/' + workItemData.id;
            $url.attr('href', href).html(workItemData.fields['System.WorkItemType'] + ' ' + workItemData.id);
            $title.html(workItemData.fields['System.Title']);

            var lane = '';
            var column = '';
            for(var key in workItemData.fields) {
                if(key.indexOf('_Kanban.Column') >= 0 && key.indexOf('_Kanban.Column.Done') < 0) {
                    column = workItemData.fields[key];
                } else if(key.indexOf('_Kanban.Lane') >= 0) {
                    lane = workItemData.fields[key];
                }
            }

            var description = '';
            if(workItemData.fields['System.Description']) {
                description = '<div class="workitem-description-details">' + workItemData.fields['System.Description'] + '</div>';
            }

            var status = '<table>';
            status += tableWrap('State', workItemData.fields['System.State']);
            status += tableWrap('Area', workItemData.fields['System.AreaPath']);
            status += tableWrap('Lane', lane);
            status += tableWrap('Column', column);
            status += tableWrap('Tags', workItemData.fields['System.Tags']);
            status += tableWrap('Assigned to', workItemData.fields['System.AssignedTo']);
            status += tableWrap('Description', description, true);
            status += '</table>';

            $status.html(status);
        });
    }
}

if(window.location.pathname.indexOf('pullrequests') >= 0) { // PR overview
    $(document).ajaxComplete(function(event, request, settings) { // trigger after moving tasks
        if(settings && settings.url && settings.url.indexOf('pullRequests?status=') >= 0 && settings.url.indexOf('pullRequests?status=1') < 0 && request.responseJSON) {
            setTimeout(function() {
                $rightPane = $('.rightPane');
                $prEntries = $rightPane.find('.vc-pullrequest-entry');
                showPrInfo(request.responseJSON);
            }, 50);
        }
    });
} else { // PR detail
    $.ajaxPrefilter(function( options, originalOptions, jqXHR ) {
        // Modify ajax request to return all fields... definitely not a hack :D
        if(options && options.url && options.url.indexOf('_apis/wit/workItems') >= 0) {
            var parsedData = parseParams(options.data);
            delete parsedData.fields;
            options.data = $.param(parsedData);
        }
    });
    var to;
    $(document).ajaxComplete(function(event, request, settings) { // trigger after moving tasks
        if(settings && settings.url && settings.url.indexOf('/tfs/DefaultCollection/_apis/git/repositories/') >= 0 && settings.url.indexOf('/pullRequests/') >= 0 && settings.url.indexOf('/workitems') < 0 && request.responseJSON) {
            prDesc = request.responseJSON.description;
        }
        else if(settings && settings.url && settings.url.indexOf('_apis/wit/workItems') >= 0 && request.responseJSON) {
            workItemsData = request.responseJSON.value;
        }
        clearTimeout(to);
        to = setTimeout(function() {
            renderMarkdown();
            renderWorkItemsDetails();
        }, 50);
    });
}
