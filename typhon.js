function finishTab(caseId, info) {
  chrome.runtime.sendMessage({"message": "process", "caseLog": caseId}, function(response) {
    window.close();
  });
}

var link = document.createElement("a");
link.href = window.location.href;
if (link.pathname == "/past/data/search.asp") {
  alert("Starting download of all MR's into PDF's");
  chrome.runtime.sendMessage({"message": "inProgress"}, function(response) {
    if (response.inProgress == true) {
      var timer = setInterval(function() {
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
                clearInterval(timer);
                alert("All done!");
              }
            });
          }
        });
      }, 1001);
    }
  });
} else if (link.pathname == "/past/data/viewdetail.asp") {
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

  processing = 0;
  if (true) {  // TODO: replace with flag
    otherInfo = otherInfoTable.getElementsByTagName("tr");
    for (var i = 0; i < otherInfo.length; i++) {
      if (otherInfo[i].innerText.includes("Minimum Requirement Encounter")) {
        if (otherInfo[i].innerText.split(":")[1].trim() == "Yes") {
          processing += 1;
          exportPdf.click();
          // TODO: will hang - need to close the tab after the download finishes
        }
      }
    }
  }

  // TODO: verify constraints here

  if (processing == 0) {
    finishTab(caseId, {});
  }
}
