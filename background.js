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
  var res = "Disclaimer: This program attempts to verify the requirements as much as possible, but only assists in the verification and does not replace everything.<br>\
It tries to verify the following:<br>\
* Case logs where the patient is >= 65 years old should be a Geriatric rotation and vice versa<br>\
* Case logs with a psychiatric disorder diagnosis (ICD-10 code starting with F) should be a Psyhicatric rotation and vice versa<br>\
* Case logs with the Reason for Visit = Sports Physical should have a sports physical diagnosis code (ICD-10 code that equals Z02.5) and vice versa<br>\
* Case logs with the Reason for Visit = Sports Physical or sports physical diagnosis code (ICD-10 code that equals Z02.5) should have the Type of HP = Detailed<br>\
* Case logs with the Reason for Visit = Sports Physical or sports physical diagnosis code (ICD-10 code that equals Z02.5) should have the CPT Billing Code match 99204 or 99214<br>\
* Case logs with the Reason for Visit = Annual/Well-Person Exam should have the Type of HP = Comprehensive (or Detailed for OB/GYN) and vice versa<br>\
* Case logs with the Reason for Visit = Annual/Well-Person Exam should have the CPT Billing Code match 9939X or 9938X (or 99204 or 99214 for OBGYN) and vice versa<br>\
* Case logs should never have CPT Billing Code match 99205 and 99215<br>\
* Case logs should never have Reason for Visit = Unmarked<br>\
* Case logs should never have Type of HP = Unmarked<br>\
* Case logs with the Type of HP = Problem Focused should have the CPT Billing code match 99202 or 99212 or 99282 and vice versa<br>\
* Case logs with the Type of HP = Expanded Problem Focused should have the CPT Billing code match 99203 or 99213 or 99243 and vice versa<br>\
* Case logs with the Type of HP = Detailed should have the CPT Billing code match 99204 or 99214 or 99244 or 99284 and vice versa<br>\
* Case logs with the Reason for Visit = Initial Visit should have the CPT Billing code match 9920X and vice versa<br>\
* Case logs with the Reason for Visit = New Consult should have the CPT Billing code match 9924X and vice versa<br>\
* Case logs with a preventative health diagnosis (ICD-10 Diagnosis code starting with Z00) should have the CPT Billing code match 993XX and vice versa<br>\
* Case logs with the Reason for Visit = Scheduled Procedure should have Intra-op checked under Surgical Management and vice versa<br>";
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

