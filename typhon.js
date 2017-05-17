function allTabsClosed(tabs) {
  for (var i = 0; i < tabs.length; i++) {
    if (!tabs[i].closed) {
      return false;
    }
  }
  return true;
}

var link = document.createElement("a");
link.href = window.location.href;
if (link.pathname == "/past/data/search.asp") {
  chrome.runtime.sendMessage({"message": "inProgress"}, function(response) {
    if (response.inProgress == true) {
      // Used for keeping track of the tabs that this extension opens
      tabs = [];
      var timer = setInterval(function() {
        if (allTabsClosed(tabs)) {  
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
                tabs.push(window.open(link.href));
              }
              if (processing > 3) {
                break;
              }
            }
            if (processing == 0) {
              clearInterval(timer);
              // TODO: Click the next arrow here, or if there is none, then be done and show results.
              alert("all done with this page!");
            }
          });
        }
      }, 500);
    }
  });
} else if (link.pathname == "/past/data/viewdetail.asp") {
  var tables = document.getElementsByTagName('table');
  var caseTable = tables[2];  // Magic
  var caseId = caseTable.getElementsByTagName('td')[0].innerText.trim().split("Case ID #: ")[1];
  // TODO: more processing here
  chrome.runtime.sendMessage({"message": "process", "caseLog": caseId}, function(response) {
    window.close();
  });
}
