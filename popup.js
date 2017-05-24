var button = document.getElementById("start");
var error = document.getElementById("error");
var verify = document.getElementById("verify");
var download = document.getElementById("download");
var numTabs = document.getElementById("numTabs");
button.onclick = function(e) {
  chrome.tabs.query({"highlighted": true}, function(tabs) {
    found = false;
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i];
      var link = document.createElement("a");
      link.href = active.url;
      if (link.host.includes("typhongroup") && link.pathname == "/past/data/search.asp") {
        var options = {"verify": verify.checked, "download": download.checked, "numTabs": numTabs.value};
        chrome.runtime.sendMessage({"message": "popup.start", "tabId": active.id, "options": options});
        found = true;
        break;
      }
    }
    if (found) {
      window.close();
    } else {
      error.innerText = "It looks like you're not on the typhon search page. Navigate there first.";
    }
  });
}
