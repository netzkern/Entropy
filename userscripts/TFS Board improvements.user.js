// ==UserScript==
// @name         TFS Board improvements
// @namespace    de.netzkern
// @version      1.2.4
// @description  Some TFS improvements.
// @author       Florian Koch . netzkern
// @match        *://backlog.netzkern.de/tfs/*/_backlogs/board/*
// @grant        GM_addStyle
// ==/UserScript==
/* jshint -W097 */
'use strict';

// changelog:
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
setTimeout(sp3Ga3KBMD25M4HR, timerDelay);

$(document).ajaxComplete(function(event, request, settings) { // trigger after moving tasks
    if(settings && settings.url && (settings.url.indexOf('_api/_wit/updateWorkItems') > 0 || settings.url.indexOf('_api/_ReorderWorkItems/ReorderWorkItems') > 0)) {
        setTimeout(sp3Ga3KBMD25M4HR, timerDelay);
    }
});