var inProgress = false;
var seen = {};
var childTabs = [];
var childDownloads = {};
var mainTab = null;
var caseIdMapping = {};

// TODO: make a diagram for the flows here because it's all very confusing
chrome.tabs.onRemoved.addListener(
  function(tabId, removeInfo) {
    for (var i = 0; i < childTabs.length; i++) {
      if (childTabs[i] == tabId) {
        childTabs.splice(i, 1);
        if (childTabs.length == 0) {
          chrome.tabs.sendMessage(mainTab, {"message": "mainTab.childrenDoneProcessing"});
        }
        break;
      }
    }
  }
);

// Waits for download to finish, then looks up appropriate tab and sends downloadFinished message
chrome.downloads.onChanged.addListener(
  function(downloadData) {
    if (downloadData.id in childDownloads) {
      tabId = childDownloads[downloadData.id];
      chrome.tabs.sendMessage(tabId, {"message": "caseLog.downloadFinished"});
    }
  }
);

// Links download to tab id
chrome.downloads.onCreated.addListener(
  function(downloadItem) {
    var link = document.createElement("a");
    link.href = downloadItem.url;
    var vars = link.search.substring(1).split("&");
    var varObj = {};
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      varObj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
    if ("myname" in varObj) {
      var caseId = varObj["myname"].replace("viewdetail-", "");
      childDownloads[downloadItem.id] = caseIdMapping[caseId];
    }
  }
);

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.message == "start") {
      seen = {};
      mainTab = sender.tab.id;
      childDownloads = [];
      caseIdMapping = {};
      inProgress = true;
    } else if (request.message == "inProgress") {
      sendResponse({"inProgress": inProgress});
    } else if (request.message == "stop") {
      inProgress = false;
    } else if (request.message == "processedCaseLogs") {
      sendResponse({"seen": seen});
    } else if (request.message == "process") {
      seen[request.caseLog] = true;  // TODO: store more information here
      console.log("processed " + request.caseLog);
      sendResponse({});
    } else if (request.message == "newtab") {
      console.log("newtab");
      chrome.tabs.create({url: request.link, selected: false}, function(tab) {
        childTabs.push(tab.id);
      });
      sendResponse({});
    } else if (request.message == "childTabs") {
      sendResponse(childTabs);
    } else if (request.message == "download") {
      caseIdMapping[request.caseId] = sender.tab.id;
    } // TODO: add done message to consolidate results
  }
);

