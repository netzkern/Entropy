// ==UserScript==
// @name         TFS Board improvements
// @namespace    de.netzkern
// @version      1.3.0
// @description  Some TFS improvements.
// @author       Florian Koch . netzkern
// @match        *://backlog.netzkern.de/tfs/*/_backlogs/*
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/remarkable/1.6.2/remarkable.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/1.5.13/clipboard.min.js
// ==/UserScript==
/* jshint -W097 */
'use strict';

// changelog:
// 1.3.0 - Copy Item name to branch name
// 1.2.4 - new filter: username
// 1.2.3 - bugfix: prevent filters from appearing multiple times when moving tasks
// 1.2.2 - board filter-presets
// 1.2.1 - basic ajax event triggering to re-highlight after moving tasks
// 1.2   - don't highlight tasks under New and Done
// 1.1   - better highlighting, mark tasks older tasks red
// 1.0   - highlight name and fade non-current tasks

function versionCompare(v1, v2, options) {
    var lexicographical = options && options.lexicographical,
        zeroExtend = options && options.zeroExtend,
        v1parts = v1.split('.'),
        v2parts = v2.split('.');

    function isValidPart(x) {
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push("0");
        while (v2parts.length < v1parts.length) v2parts.push("0");
    }

    if (!lexicographical) {
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }

    for (var i = 0; i < v1parts.length; ++i) {
        if (v2parts.length == i) {
            return 1;
        }

        if (v1parts[i] == v2parts[i]) {
            continue;
        }
        else if (v1parts[i] > v2parts[i]) {
            return 1;
        }
        else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
}

function parseVersion(versionString) {
    return versionString.replace(/[^\d\.-]/g, '');
}

// CSS styling
GM_addStyle ( "                                     \
    .filter-presets {                               \
        float: left;                                \
    }                                               \
    .filter-presets li:first-child {                \
        margin-right: 10px;                         \
    }                                               \
    .filter-presets .text {                         \
        cursor: default;                            \
        pointer-events: none;                       \
        font-weight: bold;                          \
    }                                               \
    .board-tile.not-current {                       \
        opacity: 0.6                                \
    }                                               \
    .board-tile.older-than-current {                \
        outline: 2px dashed rgba(255,0,0,0.5);      \
    }                                               \
    [field=\"System.AssignedTo\"].highlight {       \
        font-weight: bold;                          \
        color: #00f;                                \
    }                                               \
    .copy-branch-name {                             \
        margin-right: 10px;                         \
        cursor: pointer;                            \
    }                                               \
    .copy-branch-name-text-container {              \
        position: absolute;                         \
        opacity: 0.001;                             \
        display: none;                              \
    }                                               \
" );

var timerDelay = 200;
var maxTries = 10;
var currentTry = 0;

var sp3Ga3KBMD25M4HR = function () {
    currentTry++;
    // cancel after maxTries attempts
    if(currentTry > maxTries) {
        return;
    }

    var $currentIteration = $('.node.folder[title="Current"]');
    if (!$currentIteration.length) {
        // no current iteration - not ready yet
        setTimeout(sp3Ga3KBMD25M4HR, timerDelay);
        return;
    }
    if(!$currentIteration.hasClass('expanded')) {
        // open current iteration, if closed - not ready yet
        $currentIteration.find('> .node-link .node-img').click();
        setTimeout(sp3Ga3KBMD25M4HR, timerDelay);
        return;
    }
    var $board = $('.agile-board');
    if(!$board.length) {
        // no board - not ready yet
        setTimeout(sp3Ga3KBMD25M4HR, timerDelay);
        return;
    }
    var $tiles = $board.find('.board-tile-content');
    if(!$tiles.length) {
        // no tiles - not ready yet
        setTimeout(sp3Ga3KBMD25M4HR, timerDelay);
        return;
    }
    var $user = $('.menu-item[command="user"]');
    if(!$user.length) {
        // no user - not ready yet
        setTimeout(sp3Ga3KBMD25M4HR, timerDelay);
        return;
    }
    var user = $user.find('.text').text();
    var currentIteration = $currentIteration.find('> .tree-children .node-content').text();
    var currentVersion = parseVersion(currentIteration);

    // filter-presets
    var $searchContainer = $('.hub-pivot .filters .agile-board-search-container');
    var enterEvent = jQuery.Event( 'keyup', { which: $.ui.keyCode.ENTER } );
    var filterPreset = function (e) {
        e.preventDefault();
        var $this = $(e.target);
        var filterValue = $this.data('filtervalue');
        if(filterValue) {
            if(!$searchContainer.hasClass('active')) {
                $searchContainer.find('.icon-header-search').click();
            }
            $searchContainer.find('.text-filter-input').val(filterValue).trigger(enterEvent).blur();
        }
    }
    var $filters = $('.hub-pivot .filters');
    var $filterPresets = $('<ul class="filter-presets pivot-view">');
    // filter text
    var $filterPresetsText = $('<li><a class="text">Filter:</a></li>');
    $filterPresets.append($filterPresetsText);
    // filter current iteration
    var $filterCurrentIteration = $('<li><a href="#" data-filtervalue="' + currentIteration + '">' + currentIteration + '</a></li>');
    $filterCurrentIteration.click(filterPreset);
    $filterPresets.append($filterCurrentIteration);
    // filter user
    var $filterUser = $('<li><a href="#" data-filtervalue="' + user + '">' + user + '</a></li>');
    $filterUser.click(filterPreset);
    $filterPresets.append($filterUser);
    // clear old and add filters
    $filters.find('.filter-presets').remove();
    $filters.prepend($filterPresets);

    // main tile loop
    $tiles.each(function() {
        var $this = $(this);

        var specialCell = $this.closest('.cell').children('.label').text();
        var $boardTile = $this.closest('.board-tile');
        var $assignedTo = $this.find('[field="System.AssignedTo"]');

        // reset
        $boardTile.removeClass('older-than-current').removeClass('not-current');
        $assignedTo.removeClass('highlight');

        if(!specialCell) {
            var iteration = $this.find('[field="System.IterationPath"] .field-inner-element').text();
            if(currentVersion) {
                // add red border to older tasks
                if(versionCompare(currentVersion, parseVersion(iteration)) > 0) {
                    $boardTile.addClass('older-than-current');
                }
            }
            if(currentIteration) {
                // fade out tasks not in current iteration
                if(iteration != currentIteration) {
                    $boardTile.addClass('not-current');
                }
            }
        }
        if(user) {
            // highlight own name
            var assignedUser = $assignedTo.find('.field-inner-element').text();
            if(assignedUser == user) {
                $assignedTo.addClass('highlight');
            }
        }
    });
}

if(window.location.href.indexOf('/_backlogs/board/') > 0) {
    setTimeout(sp3Ga3KBMD25M4HR, timerDelay);

    $(document).ajaxComplete(function(event, request, settings) { // trigger after moving tasks
        if(settings && settings.url && (settings.url.indexOf('_api/_wit/updateWorkItems') > 0 || settings.url.indexOf('_api/_ReorderWorkItems/ReorderWorkItems') > 0)) {
            setTimeout(sp3Ga3KBMD25M4HR, timerDelay);
        }
    });
}

$(document).ajaxComplete(function(event, request, settings) { // trigger after moving tasks
    if(settings && settings.url && (settings.url.indexOf('_apis/core/identityMru') > 0 || settings.url.indexOf('_apis/customerintelligence/Events') > 0 || settings.url.indexOf('_api/_wit/pageWorkItems') > 0)) {
        var $workItemInfoBar = $('.ui-dialog .workitem-info-bar .info-text-wrapper');
        if($workItemInfoBar.length) {
            var caption = $workItemInfoBar.find('.caption').text();
            var infoText = $workItemInfoBar.find('.info-text').text();
            var rawName = caption + ' ' + infoText;
            var branchName = rawName;
            branchName = branchName.replace('Product Backlog Item', 'PBI');
            branchName = branchName.replace(/\s/g, '_');
            branchName = branchName.replace(/ä/g, 'ae');
            branchName = branchName.replace(/Ä/g, 'Ae');
            branchName = branchName.replace(/ö/g, 'oe');
            branchName = branchName.replace(/Ö/g, 'Oe');
            branchName = branchName.replace(/ü/g, 'ue');
            branchName = branchName.replace(/Ü/g, 'Ue');
            branchName = branchName.replace(/ß/g, 'ss');
            branchName = branchName.replace(/\W/g, '');
            var $copyBranchName = $workItemInfoBar.find('.copy-branch-name');
            if(!$copyBranchName.length) {
                var $copyBranchNameTextContainer = $('<div>', {
                    class: 'copy-branch-name-text-container'
                });
                var $copyBranchNameText = $('<input>', {
                    type: 'text',
                    value: branchName,
                    id: 'copy-branch-name-text'
                }).prependTo($copyBranchNameTextContainer);
                var $copyBranchName = $('<button>', {
                    class: 'copy-branch-name',
                    title: 'Branchnamen kopieren',
                    'data-clipboard-target': '#copy-branch-name-text'
                });
                $copyBranchNameImg = $('<img>', {
                    width: 14,
                    height: 16,
                    src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEYAAABQCAAAAACBylzeAAABYklEQVRYw+3YvZHCMBCG4TekAjKaoQnSixVSgku40Llm3AaRcwfOVIsu8MAZI7Gr9Yb+IjQjHqFfG5GrGbvr6XTtxqwIVYRXRjvTsUpnZd4UhYPUI12/yszy3ZByTmH5bGEeAAxLYQDgYWDuAOFZCgB3A3MBSM9SArgYmM1oKAaHnKcbpWwHfJPb9M70lKv91yk3Q79m5nIdVo1NchWC3JTiB3OWO946fCFJeycFmRk0J8sgMSGrEgQm6ZgkMFkZ9QrV5mD0TG7OwVgYxYQczD5Gzq8LE/FgIh5MxIOJKJnqs/elIBzzH0wsKnuZiAcTMTJ9UVExX+eo8Yjfo+Cj4KPUmb798VeaqZ1MtHeqvPyiD9M84bVV7LP8vDZD49ZUODuZlmNL4bSeN5+DYTrSC2MafRjt405cUNGHcXoVON6LbczZ5x9MsCs/ijsKRWbFjYmcqLq/kXo0q24hGyfuYKr5AwjYM/CQ2zySAAAAAElFTkSuQmCC'
                }).prependTo($copyBranchName);
                $copyBranchName.prependTo($workItemInfoBar);
                $copyBranchNameTextContainer.prependTo($workItemInfoBar);
            }
        }

        $workItemInfoBar.off('click.copybranch').on('click.copybranch', '.copy-branch-name', function (e) {
            var $copyBranchNameTextContainer = $('.copy-branch-name-text-container');
            $copyBranchNameTextContainer.show();
            setTimeout(function() {
                $copyBranchNameTextContainer.hide();
            }, 10);
        });
    }
});

var clipboard = new Clipboard('.copy-branch-name');

if(window.location.href.indexOf('/_backlogs/TaskBoard/') > 0) {
    // for later ;)
}