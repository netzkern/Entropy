// ==UserScript==
// @name         TFS Pull Request improvements
// @namespace    de.netzkern
// @version      1.0.2
// @description  Some TFS improvements.
// @author       Florian Koch . netzkern
// @match        *://backlog.netzkern.de/tfs/*/pullrequests*
// @grant        GM_addStyle
// ==/UserScript==
/* jshint -W097 */
'use strict';

// changelog:
// 1.0.2 - removed blue border on PRs where user was added but you have not voted yet.
// 1.0.1 - removed console.log... :)
// 1.0.0 - show PR info on overview page.

// CSS styling
GM_addStyle ( "                                     \
    .vc-pullrequest-entry.reviewed {                \
        outline: 1px solid #007acc;                 \
    }                                               \
    .reviewer-image {                               \
        margin: 2px;                                \
        width: 20px;                                \
        height: 20px;                               \
        outline: 2px solid transparent;             \
    }                                               \
    .reviewer-image.me {                            \
        /*outline: 2px solid #007acc;*/             \
    }                                               \
    .merge {                                        \
        color: #0a0;                                \
        font-weight: bold;                          \
    }                                               \
    .merge.failed {                                 \
        color: red;                                 \
    }                                               \
    .status {                                       \
        font-weight: bold;                          \
    }                                               \
    .status.pos {                                   \
        color: #0a0;                                \
    }                                               \
    .status.neg {                                   \
        color: red;                                 \
    }                                               \
" );

var currentIdentity;
var $rightPane;
var $prEntries;

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

$(document).ajaxComplete(function(event, request, settings) { // trigger after moving tasks
    if(settings && settings.url && settings.url.indexOf('pullRequests?status=') >= 0 && settings.url.indexOf('pullRequests?status=1') < 0 && request.responseJSON) {
        setTimeout(function() {
            $rightPane = $('.rightPane');
            $prEntries = $rightPane.find('.vc-pullrequest-entry');
            showPrInfo(request.responseJSON);
        }, 50);
    }
});