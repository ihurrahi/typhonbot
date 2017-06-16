var processingInProgress = 0;
var link = document.createElement("a");
link.href = window.location.href;

function finishTab(caseId, info) {
  chrome.runtime.sendMessage({"message": "caseLog.process", "caseLog": caseId}, function(response) {
    window.close();
  });
}

function processCaseLogs() {
  chrome.runtime.sendMessage({"message": "mainTab.childTabs"}, function(tabs) {
    if (tabs.length == 0) {
      chrome.runtime.sendMessage({"message": "mainTab.processedCaseLogs"}, function(response) {
        processing = 0;
        var tables = document.getElementsByTagName('table');
        var dataTable = tables[3];  // Magic
        var links = dataTable.getElementsByTagName('a');
  
        // Filter to only the links to case logs
        for (var i = 0; i < links.length; i++) {
          var link = links[i];
          if (link.pathname == "/past/data/viewdetail.asp" && !(link.text in response.seen)) {
            processing += 1;
            chrome.runtime.sendMessage({"message": "mainTab.newtab", "link": link.href});
          }
          if (processing >= response.options.numTabs) {
            break;
          }
        }
        if (processing == 0) {
          // Try to find the next button
          var imgs = document.getElementsByTagName("img");
          for (var i = 0; i < imgs.length; i++) {
            if (imgs[i].src.endsWith("rpt-next.gif") && imgs[i].parentElement.tagName == "A") {
              imgs[i].parentElement.click();
              return;
            }
          }
          chrome.runtime.sendMessage({"message": "mainTab.stop"});
        }
      });
    }
  });
}

function parseCaseId() {
  var tables = document.getElementsByTagName("table");
  var caseTable = tables[2];  // Magic
  return caseTable.getElementsByTagName("td")[0].innerText.trim().split("Case ID #: ")[1];
}

function parseInformation(table) {
  var res = {};
  var rows = table.getElementsByTagName("tr");
  for (var i = 0; i < rows.length; i++) {
    var text = rows[i].innerText;
    if (text.includes(":")) {
      var pair = text.split(":");
      var key = pair.shift();
      // Join with ":" in case the value contains a colon
      res[key] = pair.join(":").trim();
    }
  }
  return res;
}

function parseCodes(table) {
  var res = {};
  var key = "";
  var rows = table.getElementsByTagName("tr");
  for (var i = 0; i < rows.length; i++) {
     var text = rows[i].innerText.trim();
     if (!text.startsWith("#")) {
       key = text;
       res[key] = [];
     } else {
       var code = text.split("-");
       res[key].push(code[1].trim());
     }
  }
  return res;
}


function checkCode(codes, beginning) {
  var res = false;
  for (var i = 0; i < codes.length; i++) {
    for (var j = 0; j < beginning.length; j++) {
      if (codes[i].toLowerCase().startsWith(beginning[j].toLowerCase())) {
        res = true;
      }
    }
  }
  return res;
}


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log("Received " + request.message);
    if (request.message == "caseLog.downloadFinished") {
      processingInProgress -= 1;
      if (processingInProgress == 0) {
        var caseId = parseCaseId();
        finishTab(caseId, {});
      }
    } else if (request.message == "mainTab.childrenDoneProcessing") {
      processCaseLogs();
    } else if (request.message == "mainTab.start") {
      processCaseLogs();
    }
  }
);

chrome.runtime.sendMessage({"message": "inProgress"}, function(response) {
  if (link.pathname == "/past/data/search.asp") {
    if (response.inProgress == true) {
      processCaseLogs();
    }
  } else if (link.pathname == "/past/data/viewdetail.asp") {
    if (response.inProgress == true) {
      var tables = document.getElementsByTagName("table");
      var caseTable = tables[2];  // Magic
      var caseId = caseTable.getElementsByTagName("td")[0].innerText.trim().split("Case ID #: ")[1];
      var caseUrl = window.location.href;
  
      var baseInfoTable = tables[3];
      var baseInfoInnerTable = tables[4];
      var codesTable = tables[6];
      var otherInfoTable = tables[8];
      var notesTable = tables[9];
  
      var baseInfo = baseInfoTable.getElementsByTagName("tr");
      var exportButtons = baseInfo[0];
      var exportPdf = exportButtons.getElementsByTagName("a")[1];
  
      if (response.options.download) {
        otherInfo = otherInfoTable.getElementsByTagName("tr");
        for (var i = 0; i < otherInfo.length; i++) {
          if (otherInfo[i].innerText.includes("Minimum Requirement Encounter")) {
            if (otherInfo[i].innerText.split(":")[1].trim() == "Yes") {
              processingInProgress += 1;
              chrome.runtime.sendMessage({"message": "caseLog.download", "caseLog": caseId});
              exportPdf.click();
            }
          }
        }
      }
  
      if (response.options.verify) {
        processingInProgress += 1;
        var errors = [];
        info = parseInformation(baseInfoInnerTable);
        codes = parseCodes(codesTable);

        // Geriatric patients
        age = parseInt(info["Age"].split(" years")[0]);
        geriatric = info["Rotation"].includes("Geriatric")
        if ((age >= 65 && !geriatric) || (!(age >= 65) && geriatric)) {
          errors.push(["Age", "Geriatric Rotation"]);
        }
        // Psychiatric disorders
        is_psychiatric = checkCode(codes["ICD-10 Diagnosis Codes"], ["F"]);
        psychiatric_rotation = info["Rotation"].includes("Psychiatric")
        if ((is_psychiatric && !psychiatric_rotation) || (!is_psychiatric && psychiatric_rotation)) {
          errors.push(["ICD-10 Diagnosis Codes", "Psychiatric rotation"]);
        }
        // Sports Physicals
        is_sports_physical = info["Reason for Visit"] == "Sports Physical";
        is_detailed = info["Type of HP"] == "Detailed";
        is_sports_physical_diagnosis = checkCode(codes["ICD-10 Diagnosis Codes"], ["Z02.5"]);
        has_detailed_cpt_sp = checkCode(codes["CPT Billing Codes"], ["99204", "99214"]);
        if ((is_sports_physical && !is_sports_physical_diagnosis) || (!is_sports_physical && is_sports_physical_diagnosis)) {
          errors.push(["Reason for Visit: Sports Physical", "ICD-10 Diagnosis Code Z02.5"]);
        }
        if ((is_sports_physical || is_sports_physical_diagnosis) && !is_detailed) {
          errors.push(["Reason for Visit: Sports Physical or ICD-10 Diagnosis Code Z02.5", "Type of HP: Detailed"]);
        }
        if ((is_sports_physical || is_sports_physical_diagnosis) && !has_detailed_cpt_sp) {
          errors.push(["Reason for Visit: Sports Physical or ICD-10 Diagnosis Code Z02.5", "CPT Billing Codes"]);
        }
        // Annual visits
        is_comprehensive = info["Type of HP"] == "Comprehensive";
        has_comprehensive_cpt = checkCode(codes["CPT Billing Codes"], ["9939", "9938", "99205", "99215"]);
        if ((is_comprehensive && !has_comprehensive_cpt) || (!is_comprehensive && has_comprehensive_cpt)) {
          errors.push(["Type of HP: Comprehensive", "CPT Billing Codes"]);
        }
        // No unmarked
        is_unmarked_rfv = info["Reason for Visit"] == "Unmarked";
        is_unmarked_hp = info["Type of HP"] == "Unmarked";
        if (is_unmarked_rfv) {
          errors.push(["Reason for Visit: Unmarked", "0"]);
        }
        if (is_unmarked_hp) {
          errors.push(["Type of HP: Unmarked", "0"]);
        }
        // Problem Focused
        is_prob_focused = info["Type of HP"] == "Problem Focused";
        has_prob_focused_cpt = checkCode(codes["CPT Billing Codes"], ["99201", "99202", "99212", "99282"]);
        if ((is_prob_focused && !has_prob_focused_cpt) || (!is_prob_focused && has_prob_focused_cpt)) {
          errors.push(["Type of HP: Problem Focused", "CPT Billing Codes"]);
        }
        // Expanded Problem Focused
        is_exp_prob_focused = info["Type of HP"] == "Expanded Problem Focused";
        has_exp_prob_focused_cpt = checkCode(codes["CPT Billing Codes"], ["99203", "99213", "99243", "99283"]);
        if ((is_exp_prob_focused && !has_exp_prob_focused_cpt) || (!is_exp_prob_focused && has_exp_prob_focused_cpt)) {
          errors.push(["Type of HP: Expanded Problem Focused", "CPT Billing Codes"]);
        }
        // Detailed
        is_detailed = info["Type of HP"] == "Detailed";
        has_detailed_cpt = checkCode(codes["CPT Billing Codes"], ["99204", "99214", "99244", "99284"]);
        if ((is_detailed && !has_detailed_cpt) || (!is_detailed && has_detailed_cpt)) {
          errors.push(["Type of HP: Detailed", "CPT Billing Codes"]);
        }
        // Initial Visits
        is_initial = info["Reason for Visit"] == "Initial Visit";
        has_initial_cpt = checkCode(codes["CPT Billing Codes"], ["9920"]);
        if ((is_initial && !has_initial_cpt) || (!is_initial && has_initial_cpt)) {
          errors.push(["Reason for Visit: Initial Visit", "CPT Billing Codes"]);
        }
        // New consult
        is_new_consult = info["Reason for Visit"] == "New Consult";
        has_new_consult_cpt = checkCode(codes["CPT Billing Codes"], ["9924"]);
        if ((is_new_consult && !has_new_consult_cpt) || (!is_new_consult && has_new_consult_cpt)) {
          errors.push(["Reason for Visit: New Consult", "CPT Billing Codes"]);
        }
        // Preventative Health
        has_phealth_cpt = checkCode(codes["CPT Billing Codes"], ["993"]);
        has_phealth_icd10 = checkCode(codes["ICD-10 Diagnosis Codes"], ["Z00"]);
        if ((has_phealth_cpt && !has_phealth_icd10) || (!has_phealth_cpt && has_phealth_icd10)) {
          errors.push(["Preventative Health ICD10 Diagnosis Codes", "Preventative Health CPT Billing Codes"]);
        }
        // Surgery
        is_scheduled = info["Reason for Visit"] == "Scheduled Procedure";
        is_intra_op = info["Setting Type"].includes("Intra-op");
        if ((is_scheduled && !is_intra_op) || (!is_scheduled && is_intra_op)) {
          errors.push(["Reason for Visit: Scheduled Procedure", "Surgical Management (intra-op)"]);
        }

        if (errors.length > 0) {
          chrome.runtime.sendMessage({"message": "caseLog.addInfo", "caseLog": caseId, "errors": errors, "caseUrl": caseUrl});
        }

        processingInProgress -= 1;
      }
  
      if (processingInProgress == 0) {
        finishTab(caseId, {});
      }
    }
  }
});
