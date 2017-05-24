var inProgress = false;
var seen = {};
var childTabs = [];
var childDownloads = {};
var mainTab = null;
var caseIdMapping = {};
var options = null;

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
    function sendResponseWrapper(response) {
      response["options"] = options;
      sendResponse(response);
    }
    if (request.message == "popup.start") {
      mainTab = request.tabId;
      seen = {};
      childDownloads = [];
      caseIdMapping = {};
      inProgress = true;
      options = request.options;
      chrome.tabs.sendMessage(mainTab, {"message": "mainTab.start"});
      sendResponseWrapper({"message": "started"});
    } else if (request.message == "inProgress") {
      sendResponseWrapper({"inProgress": inProgress});
    } else if (request.message == "mainTab.stop") {
      inProgress = false;
      sendResponseWrapper({});
    } else if (request.message == "mainTab.processedCaseLogs") {
      sendResponseWrapper({"seen": seen});
    } else if (request.message == "caseLog.process") {
      seen[request.caseLog] = true;  // TODO: store more information here
      console.log("processed " + request.caseLog);
      sendResponseWrapper({});
    } else if (request.message == "mainTab.newtab") {
      console.log("newtab");
      chrome.tabs.create({url: request.link, selected: false}, function(tab) {
        childTabs.push(tab.id);
      });
      sendResponseWrapper({});
    } else if (request.message == "mainTab.childTabs") {
      sendResponseWrapper(childTabs);
    } else if (request.message == "caseLog.download") {
      caseIdMapping[request.caseId] = sender.tab.id;
      sendResponseWrapper({});
    } // TODO: add done message to consolidate results
  }
);

