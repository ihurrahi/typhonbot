var button = document.getElementById("start");
var error = document.getElementById("error");
button.onclick = function(e) {
  chrome.tabs.query({"highlighted": true}, function(tabs) {
    found = false;
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i];
      console.log(active);
      var link = document.createElement("a");
      link.href = active.url;
      if (link.host.includes("typhongroup") && link.pathname == "/past/data/search.asp") {
        chrome.runtime.sendMessage({"message": "popup.start", "tabId": active.id});
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
