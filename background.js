var inProgress = true;
var seen = {};
var childTabs = [];

chrome.tabs.onRemoved.addListener(
  function(tabId, removeInfo) {
    for (var i = 0; i < childTabs.length; i++) {
      if (childTabs[i] == tabId) {
        childTabs.splice(i, 1);
      }
    }
  }
);

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.message == "start") {
      seen = {};
      inProgress = true;
    } else if (request.message == "inProgress") {
      sendResponse({"inProgress": inProgress});
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
    } // TODO: add done message to consolidate results
  }
);

