var inProgress = false;
var seen = {};
var childTabs = [];
var childDownloads = {};
var caseIdMapping = {};
var mainTab = null;
var options = null;

function addToSeen(caseLog) {
  if (!(caseLog in seen)) {
    seen[caseLog] = {};
  }
}

function getData() {
  var totalDownloads = 0;
  var res = "Disclaimer: This program attempts to verify the requirements as much as possible, but does not claim to be complete in any way.<br>Things it definitely does not do are: making sure your date range is correct, and verifying that all ICD-10 and CPT codes are valid.<br>";
  var errors = "";
  for (var key in seen) {
    if (seen.hasOwnProperty(key)) {
      if ("errors" in seen[key]) {
        errors += "<a target=\"_blank\" href=\"" + seen[key]["caseUrl"] + "\">" + key + "</a>:<br>";
        for (var i = 0; i < seen[key]["errors"].length; i++) {
          errors += "  Mismatch of " + seen[key]["errors"][i].join(" and ") + "<br>";
        }
      }
      if ("download" in seen[key]) {
        totalDownloads += 1;
      }
    }
  }
  if (options.verify) {
    if (errors != "") {
      res += "<br><b>Errors Found</b><br>";
      res += errors;
    } else {
      res += "<br><b>No Errors Found</b><br>";
    }
  }
  if (options.download) {
    res += "<br><b>Downloads</b><br>";
    res += "Downloaded a total of " + totalDownloads + " MR's.<br>";
  }
  return res;
}

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
    console.log("Received " + request.message);
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
      var data = getData();
      chrome.tabs.create({url: "data:text/html," + data, selected: true});
      sendResponseWrapper({});
    } else if (request.message == "mainTab.processedCaseLogs") {
      sendResponseWrapper({"seen": seen});
    } else if (request.message == "caseLog.process") {
      addToSeen(request.caseLog);
      sendResponseWrapper({});
    } else if (request.message == "caseLog.addInfo") {
      addToSeen(request.caseLog);
      seen[request.caseLog]["errors"] = request.errors;
      seen[request.caseLog]["caseUrl"] = request.caseUrl;
      sendResponseWrapper({});
    } else if (request.message == "caseLog.download") {
      addToSeen(request.caseLog);
      seen[request.caseLog]["download"] = true;
      caseIdMapping[request.caseLog] = sender.tab.id;
      sendResponseWrapper({});
    } else if (request.message == "mainTab.newtab") {
      chrome.tabs.create({url: request.link, selected: false}, function(tab) {
        childTabs.push(tab.id);
      });
      sendResponseWrapper({});
    } else if (request.message == "mainTab.childTabs") {
      sendResponseWrapper(childTabs);
    } // TODO: add done message to consolidate results
  }
);

