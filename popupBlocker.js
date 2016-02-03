/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

if (require("info").platform == "chromium")
{
  var logRequest = require("devtools").logRequest;
  var tabsLoading = {};

  chrome.webNavigation.onCreatedNavigationTarget.addListener(function(details)
  {
    var sourcePage = new ext.Page({id: details.sourceTabId});
    var sourceFrame = ext.getFrame(details.sourceTabId, details.sourceFrameId);

    if (checkWhitelisted(sourcePage, sourceFrame))
      return;

    var documentHost = extractHostFromFrame(sourceFrame);
    if (!documentHost)
      return;

    var specificOnly = !!checkWhitelisted(sourcePage, sourceFrame,
                                          RegExpFilter.typeMap.GENERICBLOCK);

    tabsLoading[details.tabId] = {
      page: sourcePage,
      documentHost: documentHost,
      specificOnly: specificOnly
    };
    checkPotentialPopup(details.tabId, details.url, sourcePage, documentHost, specificOnly);
  });

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab)
  {
    if (!(tabId in tabsLoading))
    {
      // Not a pop-up we've previously seen
      return;
    }

    if ("url" in changeInfo)
    {
      var source = tabsLoading[tabId];
      checkPotentialPopup(tabId, tab.url, source.page,
                                          source.documentHost,
                                          source.specificOnly);
    }

    if ("status" in changeInfo && changeInfo.status == "complete" && tab.url != "about:blank")
      delete tabsLoading[tabId];
  });
}

function checkPotentialPopup(tabId, url, sourcePage, documentHost, specificOnly)
{
  var urlObj = new URL(url || "about:blank");
  var urlString = stringifyURL(urlObj);
  var thirdParty = isThirdParty(urlObj, documentHost);

  var filter = defaultMatcher.matchesAny(
    urlString, RegExpFilter.typeMap.POPUP,
    documentHost, thirdParty, null, specificOnly
  );

  if (filter instanceof BlockingFilter)
    chrome.tabs.remove(tabId);

  logRequest(
    sourcePage, urlString, "POPUP", documentHost,
    thirdParty, null, specificOnly, filter
  );
}
