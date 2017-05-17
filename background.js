var inProgress = true;
var seen = {};

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
    } // TODO: add done message to consolidate results
  }
);

