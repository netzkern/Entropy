// ==UserScript==
// @name         TFS Board improvements
// @namespace    de.netzkern
// @version      1.3.1
// @description  Some TFS improvements.
// @author       Florian Koch . netzkern
// @match        *://backlog.netzkern.de/tfs/*
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/remarkable/1.6.2/remarkable.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/1.5.13/clipboard.min.js
// ==/UserScript==
/* jshint -W097 */
'use strict';

// changelog:
// 1.3.1 - Copy Item name to practical hash name, also fix it not appearing on item detail pages
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
GM_addStyle ( "                             \
.filter-presets {                           \
float: left;                                \
}                                           \
.filter-presets li:first-child {            \
margin-right: 10px;                         \
}                                           \
.filter-presets .text {                     \
cursor: default;                            \
pointer-events: none;                       \
font-weight: bold;                          \
}                                           \
.board-tile.not-current {                   \
opacity: 0.6                                \
}                                           \
.board-tile.older-than-current {            \
outline: 2px dashed rgba(255,0,0,0.5);      \
}                                           \
[field=\"System.AssignedTo\"].highlight {   \
font-weight: bold;                          \
color: #00f;                                \
}                                           \
.copy-name {                                \
height: 26px;                               \
margin: 2px 10px 2px 0;                     \
padding: 2px;                               \
background: white;                          \
}                                           \
.copy-name img {                            \
display: block;                             \
}                                           \
.copy-name-text-container {                 \
position: absolute;                         \
opacity: 0.001;                             \
display: none;                              \
}                                           \
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

function addCopyButtonToWorkItemInfo($workItemInfoBar, text, identifier, title, icon) {
    var $copyName = $workItemInfoBar.find('#copy-' + identifier + '-name');
    if(!$copyName.length) {
        var $copyNameTextContainer = $('<div>', {
            class: 'copy-name-text-container',
            id: 'copy-' + identifier + '-name-text-container',
        });
        var $copyNameText = $('<input>', {
            type: 'text',
            value: text,
            id: 'copy-' + identifier + '-name-text'
        }).prependTo($copyNameTextContainer);
        var $copyName = $('<button>', {
            class: 'copy-name',
            id: 'copy-' + identifier + '-name',
            title: title,
            'data-clipboard-target': '#copy-' + identifier + '-name-text'
        });
        $copyNameImg = $('<img>', icon).prependTo($copyName);
        $copyName.prependTo($workItemInfoBar);
        $copyNameTextContainer.prependTo($workItemInfoBar);
    }

    $workItemInfoBar.off('click.' + identifier).on('click.' + identifier, '.copy-name', function (e) {
        var $copyNameTextContainer = $('#copy-' + identifier + '-name-text-container');
        $copyNameTextContainer.show();
        setTimeout(function() {
            $copyNameTextContainer.hide();
        }, 10);
    });
}

function generateBranchName(rawName) {
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
    return branchName;
}

function generatePracticalName(rawName) {
    var branchName = rawName;
    branchName = branchName.replace(/^[\D]+/, '#');
    return branchName;
}

var branchIcon = {
    width: 20,  //8
    height: 20, //8
    src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAAAAACreq1xAAACn0lEQVRYw62ZLZKjQBTH/xeYU8TErMavxsZEoDAIFG5UV3VVH4AjxMWOmqq4KG4wF4iLGhn1VrDsNND9PmAxqQqPX/r1n35fAWmujxKoBpUpNEYVAADhfwFrQE+EgaciQuvvePn9wBNml9sLPAM2Igz+qryGVg+tMjzwBjNRcHlIEt0OUczEPLAfP+5JorcDK3QcMViBNbCNCO7967h99BbgdD5auzLgz8e0xmPdlro1Qjgf3c/Xz06zj5DOW0Ski4IIMR7ExFb2GmK8wvXn5kNWBnK8ekS3f4vKQI5X3/zvBQ5Ypd63Zz4hJIgQeYgS/Es+M2D1AABUYsR1aWB6fQA+I/u7RASfP9ZEKStAwQMaIqLXaPjJEyH5CwD4RUT06DiinwPPLA8FEdFzeohVBtnXKwGcHuKUgexvBJyIt7zXkPSYA/8RL8O9P6SUgYYXAWfHok8QIfs7B0pEfMAInB20VTgbUJqBcTxbvZM1YAaW0Qq/l5ZvG4A1sfGs2rXC59LyhGHXHl6XljdQMAOjmH9YhSWQhjgH4p7L0+149IIViMu4gdWaNwYHbwXi8H7p62QYHsOXswLzyexvgHX7gfU8Bfi9wGaZpIKYU1hgu06jHLHPlw0LXpzo8/v4RUIqq9OliBN4RIXImxdLaWXepUatyZdzgV8g0VHiLQvOIBScZ06PZEnsrcBGKtod63LB6ZFpKzxT8n5J60s2PiHfBpQiL9maLYnHqWzvZF66eVx5fX0R0VAoeJn2dq1MUUDUg2vAvZxnGtuIQMwzrXWIEbbxmDGL3+AvPwhyYv6wTpbcBh4/qgrG/ZNnX8HMk4Zp3qKHajrnLPunGuqGfPO8cezcG/zVDcZ7rR7q0X1v4On+XOi1/mqBNNRvON1Upn8AUnSIzlg0IVMAAAAASUVORK5CYII='
};
var practIcon = {
    width: 23,  //8
    height: 20, //7
    src: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAFAASQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAAABwEGCAUEA//EADsQAAEDAwIDAwcJCQAAAAAAAAECAwUABBEGEgcTITFBURQiMmGRlNIIFRdWZXFywtEWJCVSZIGSobH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AeNRRRQFFFUbVXFPT+lplyJkWr9dy2lKlFhpKk+cMjtUO6gvNFeWKvm5SMtJBhDiGrplDyEuDCglSQRkeODXx1BMW0BDXUrfBw29qjesNgFRGcdASOvXxoOhRVM0dxKhNYSrkbFMX6Xm2FPqU+2lKQkFI7lE5yod1XOgKKKKCaKKo/F7VElpHTNvIxBZ567xDKucjcNpQs9me3KRQXismcWrny3iPNrR52Hw0APFCUpx/qu39N+sPs/3c/FVCupS4upp2Wf2KuXbk3K/N80rKtx6eGe6g2bH24tLG3tk9Ay0lsD7gBVH463Pk/Di+RnBfdZbH+YV/xJpT/TfrD7P93PxVw9XcRp/V0a3HyxtuQ28HgGWtpKgCBnr2ecaC9fJptguSnbrHVtllsH8SlH8lPqsi6O17M6OYuWYcWuLlSVOF5rcegIHePE07+DOtpjWSZdUz5P8AuhZDXJb2+lvznqc+iKBl0UUUBXilYiOmbdNvLWVveMJWFpbfbC0hWCM4Pfgn217a8UtLR0NbpuJa9t7NlSwhLj7gQkqwTjJ78A+yg4Epo3SNlGXd2rTkUAwwtwnyVHTaknw9VZ04VRlvL6+ibK8YQ/brWtTjbidyVBKFK6j+1PfXut9NvaLmmLGdj37h6zcabaauEqUoqG3oAfXSd4IX0bGa1N5L3tvZstWjmxx9wIBUSkYBPfgn2UGgP2E0l9W4v3VH6Ul+P8TDw1/D20PHWtkVNOuO+TtBG/JSBnH3H206P270l9ZIv3pH60guOc1ZTesmnoy8Zu7ZqybbDjKwpOdylHqPxUDH4OaPgJDQNleykPZXdw+46rmPsJUrAWUgZPd5tMaIgYiE5vzRG2tlzsczydoI34zjOO3GT7apvDzVel4rRELZXE9GsvN2qS42u4SClSvOIIz25Jq5xE9ETfN+aJK1veTjmeTuhezOcZx2ZwfZQdGoqaigmqPxe0vJau0zbx0QGeei8Q8rnL2jaELHge9Qq8UUGT9V8NZ/SkV85SyrMMcxLY5T25RUc46Y9RrxaN0NM6yF2YcMYtNnMLzm30s4x0OfRNN/5SVyE6airTPV29LgH4UKH56n5N1ts0vJ3WOrt9sz4hKEn8xoKJ9B+sPs/wB4Pw1Q5uKuIWWuYu8KFXFs5y3OWrcnd6jW1KyI6BM8TVD003k2R94U9+hoLGOCGsCAf4f1/qD8NM3gzomY0amXTMi3/eyyWuS5u9HfnPQY9IUy6KAqKmooJooooKrrbQcTrVVmZd68QLML5Yt3Epzv25zlJ/lFdDSOmbDSUQIuMU8pgOKc3PKClEnt6gDwrtUUEEZGM4pewvB3TUNL2kpbPyTlxauh1AdeQUlQ7M4QKYdFAUUUUBRRRQf/2Q=='
};

function addCopyButtonsToWorkItemInfo($workItemInfoBar) {
    if($workItemInfoBar.length) {
        var caption = $workItemInfoBar.find('.caption').text();
        var infoText = $workItemInfoBar.find('.info-text').text();
        var rawName = caption + ' ' + infoText;
        addCopyButtonToWorkItemInfo($workItemInfoBar, generateBranchName(rawName), 'branch', 'Branchnamen kopieren', branchIcon);
        addCopyButtonToWorkItemInfo($workItemInfoBar, generatePracticalName(rawName), 'pract', 'Praktischeren Namen kopieren', practIcon);
    }
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
        addCopyButtonsToWorkItemInfo($('.ui-dialog .workitem-info-bar .info-text-wrapper'))
    }

    if(window.location.hash.indexOf('id=') > 0 && (window.location.href.indexOf('_workitems') > 0 || window.location.href.indexOf('_workItems') > 0)) {
        addCopyButtonsToWorkItemInfo($('.workitem-info-bar .info-text-wrapper'))
    }
});

var clipboard = new Clipboard('.copy-name');

if(window.location.href.indexOf('/_backlogs/TaskBoard/') > 0) {
    // for later ;)
}