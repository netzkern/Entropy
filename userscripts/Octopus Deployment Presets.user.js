// ==UserScript==
// @name         Octopus Deployment Presets
// @namespace    de.netzkern
// @version      1.1
// @description  Adds presets to EWE Octopus deployment for file-only deployments.
// @author       Lara Kresse . netzkern
// @match        *://deployment.netzkern.de/*
// @grant        none
// ==/UserScript==
/* jshint -W097 */
'use strict';

var hash = window.location.hash;

var locationHashChanged = function() {
    var isDeploymentPage = document.location.hash.indexOf('deployments/create') >= 0;
    if(isDeploymentPage) {

        window.fileDeployment = function(){    
            $('[ng-click^="skipAll"]').click();

            var changeInputs = function(){
                $('div.control-group:not(.ng-isolate-scope):contains("Deploy Build Result")').find('.bootstrap-switch-handle-off').click();
                $('div.control-group:not(.ng-isolate-scope):contains("Copy Solution")').find('.bootstrap-switch-handle-off').click();
                $('div.control-group:not(.ng-isolate-scope):contains("Post Deploy Clean Up")').find('.bootstrap-switch-handle-off').click();
            }
            setTimeout(changeInputs, 100);
        }

        var presets = '<a href="#" onclick="fileDeployment(); return false;">File Deployment</a>';

        var timerDelay = 200;
        var maxTries = 10;
        var currentTry = 0;
        var d7cVpMkjaDhEWBfk = function () {    
            currentTry++;
            if(currentTry > maxTries) {
                return;
            }


            var $skipAll = $('[ng-click^="skipAll"]');
            if ($skipAll.length > 0) {
                $skipAll.after('<br />Presets: ' + presets);
            } else {
                setTimeout(d7cVpMkjaDhEWBfk, timerDelay);
            }
        }
        setTimeout(d7cVpMkjaDhEWBfk, timerDelay);
    }
}

locationHashChanged();
var interval = setInterval(function() {
    if(window.location.hash != hash) {
        locationHashChanged();
        hash = window.location.hash;
    }
}, 1000);
