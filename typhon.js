var processingInProgress = 0;
var link = document.createElement("a");
link.href = window.location.href;

function finishTab(caseId, info) {
  chrome.runtime.sendMessage({"message": "process", "caseLog": caseId}, function(response) {
    window.close();
  });
}

function processCaseLogs() {
  chrome.runtime.sendMessage({"message": "childTabs"}, function(tabs) {
    if (tabs.length == 0) {
      chrome.runtime.sendMessage({"message": "processedCaseLogs"}, function(response) {
        processing = 0;
        var tables = document.getElementsByTagName('table');
        var dataTable = tables[3];  // Magic
        var links = dataTable.getElementsByTagName('a');
  
        // Filter to only the links to case logs
        for (var i = 0; i < links.length; i++) {
          var link = links[i];
          if (link.pathname == "/past/data/viewdetail.asp" && !(link.text in response.seen)) {
            processing += 1;
            chrome.runtime.sendMessage({"message": "newtab", "link": link.href});
          }
          if (processing > 3) {
            break;
          }
        }
        if (processing == 0) {
          chrome.runtime.sendMessage({"message": "stop"}, function(response) {
            alert("All done!");
          });
        }
      });
    }
  });
}

function getCaseId() {
  var tables = document.getElementsByTagName("table");
  var caseTable = tables[2];  // Magic
  return caseTable.getElementsByTagName("td")[0].innerText.trim().split("Case ID #: ")[1];
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.message == "caseLog.downloadFinished") {
      processingInProgress -= 1;
      if (processingInProgress == 0) {
        var caseId = getCaseId();
        finishTab(caseId, {});
      }
    } else if (request.message == "mainTab.childrenDoneProcessing") {
      processCaseLogs();
    }
  }
);

chrome.runtime.sendMessage({"message": "inProgress"}, function(response) {
  if (link.pathname == "/past/data/search.asp") {
    if (response.inProgress == true) {
      processCaseLogs();
    } else {
      result = confirm("Do you want to download of all MR's into PDF's? Make sure you have the correct date filter!");
      if (result) {
        chrome.runtime.sendMessage({"message": "start"}, function(response) {
          processCaseLogs();
        });
      }
    }
  } else if (link.pathname == "/past/data/viewdetail.asp") {
    if (response.inProgress == true) {
      var tables = document.getElementsByTagName("table");
      var caseTable = tables[2];  // Magic
      var caseId = caseTable.getElementsByTagName("td")[0].innerText.trim().split("Case ID #: ")[1];
  
      var baseInfoTable = tables[3];
      var codesTable = tables[6];
      var otherInfoTable = tables[8];
      var notesTable = tables[9];
  
      var baseInfo = baseInfoTable.getElementsByTagName("tr");
      var exportButtons = baseInfo[0];
      var exportPdf = exportButtons.getElementsByTagName("a")[1];
  
      if (true) {  // TODO: replace with flag
        otherInfo = otherInfoTable.getElementsByTagName("tr");
        for (var i = 0; i < otherInfo.length; i++) {
          if (otherInfo[i].innerText.includes("Minimum Requirement Encounter")) {
            if (otherInfo[i].innerText.split(":")[1].trim() == "Yes") {
              processingInProgress += 1;
              chrome.runtime.sendMessage({"message": "download", "caseId": caseId});
              exportPdf.click();
            }
          }
        }
      }
  
      processingInProgress += 1;
      // TODO: verify constraints here
      processingInProgress -= 1;
  
      if (processingInProgress == 0) {
        finishTab(caseId, {});
      }
    }
  }
});
