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

function parseInformation(tables) {
  var res = {};
  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    rows = table.getElementsByTagName("tr");
    for (var j = 0; j < rows.length; j++) {
      var text = rows[j].innerText;
      if (text.includes(":")) {
        var pair = text.split(":");
        var key = pair.shift();
        // Join with ":" in case the value contains a colon
        res[key] = pair.join(":").trim();
      }
    }
  }
  return res;
}

function parseCodes(tables) {
  var res = {};
  var key = "";
  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    var rows = table.getElementsByTagName("tr");
    for (var j = 0; j < rows.length; j++) {
       var elements = rows[j].getElementsByTagName("td");
       var text = rows[j].innerText.trim();
       if (elements[0].getAttribute("bgcolor") == "#000000") {
         if (text == "ICD-10 Diagnosis Codes" || text == "CPT Billing Codes") {
           key = text;
           res[key] = [];
         } else {
           key = "";
         }
       } else if (key != "") {
         var code = text.split("-");
         res[key].push(code[1].trim());
       }
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
      var info = parseInformation(tables);
      var codes = parseCodes(tables);
      var caseId = parseCaseId();
      var caseUrl = window.location.href;

      if (response.options.download) {
        if (info["Minimum Requirement Encounter"] == "Yes") {
          var links = document.getElementsByTagName("a");
          var exportPdf = null;
          for (var i = 0; i < links.length; i++) {
            if (links[i].href.includes("pdfoutput-past.asp")) {
              exportPdf = links[i];
              break;
            }
          }

          processingInProgress += 1;
          chrome.runtime.sendMessage({"message": "caseLog.download", "caseLog": caseId});
          if (exportPdf != null) {
            exportPdf.click();
          } else {
            alert("Could not download PDF.");
          }
        }
      }
  
      if (response.options.verify) {
        processingInProgress += 1;
        var errors = [];

        age_str = info["Age"].split(" ");
        if (age_str[1].startsWith("year")) {
          age = parseInt(age_str[0]);
        } else if (age_str[1].startsWith("month")) {
          age = parseInt(age_str[0]) / 12;
        } else if (age_str[1].startsWith("week")) {
          age = parseInt(age_str[0]) / 52;
        } else if (age_str[1].startsWith("day")) {
          age = parseInt(age_str[0]) / 365;
        }
        // Geriatric patients
        geriatric = info["Rotation"].includes("Geriatric")
        if ((age >= 65 && !geriatric) || (!(age >= 65) && geriatric)) {
          errors.push(["Age", "Geriatric Rotation"]);
        }
        // Age constraints
        age_constraint1 = checkCode(codes["CPT Billing Codes"], ["99391", "99381"]);
        age_constraint2 = checkCode(codes["CPT Billing Codes"], ["99392", "99382"]);
        age_constraint3 = checkCode(codes["CPT Billing Codes"], ["99393", "99383"]);
        age_constraint4 = checkCode(codes["CPT Billing Codes"], ["99394", "99384"]);
        age_constraint5 = checkCode(codes["CPT Billing Codes"], ["99395", "99385"]);
        age_constraint6 = checkCode(codes["CPT Billing Codes"], ["99396", "99386"]);
        age_constraint7 = checkCode(codes["CPT Billing Codes"], ["99397", "99387"]);
        if ((age_constraint1 && !(age < 1)) ||
            (age_constraint2 && !(age >= 1 && age <= 4)) ||
            (age_constraint3 && !(age >= 5 && age <= 11)) ||
            (age_constraint4 && !(age >= 12 && age <= 17)) ||
            (age_constraint5 && !(age >= 18 && age <= 39)) ||
            (age_constraint6 && !(age >= 40 && age <= 64)) ||
            (age_constraint7 && !(age >= 65))) {
          errors.push(["Age", "CPT Billing Codes"]);
        }
        // Psychiatric disorders
        is_psychiatric = checkCode(codes["ICD-10 Diagnosis Codes"], ["F", "G47.00"]);
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
        has_comprehensive_cpt = checkCode(codes["CPT Billing Codes"], ["99205", "99215", "99285", "99310", "99306", "99245", "99222", "99223", "99255", "99234", "99235", "9939", "9938"]);
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
        has_prob_focused_cpt = checkCode(codes["CPT Billing Codes"], ["99024", "99201", "99202", "99211", "99212", "99281", "99282", "99307", "99241", "99242", "99252", "99231"]);
        if ((is_prob_focused && !has_prob_focused_cpt) || (!is_prob_focused && has_prob_focused_cpt)) {
          errors.push(["Type of HP: Problem Focused", "CPT Billing Codes"]);
        }
        // Expanded Problem Focused
        is_exp_prob_focused = info["Type of HP"] == "Expanded Problem Focused";
        has_exp_prob_focused_cpt = checkCode(codes["CPT Billing Codes"], ["99203", "99213", "99283", "99308", "99304", "99243", "99253", "99232"]);
        if ((is_exp_prob_focused && !has_exp_prob_focused_cpt) || (!is_exp_prob_focused && has_exp_prob_focused_cpt)) {
          errors.push(["Type of HP: Expanded Problem Focused", "CPT Billing Codes"]);
        }
        // Detailed
        is_detailed = info["Type of HP"] == "Detailed";
        has_detailed_cpt = checkCode(codes["CPT Billing Codes"], ["99204", "99214", "99284", "99309", "99305", "99244", "99221", "99254", "99233"]);
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
        has_phealth_icd10 = checkCode(codes["ICD-10 Diagnosis Codes"], ["Z00", "Z01.4"]);
        if (has_phealth_cpt && !has_phealth_icd10) {
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
