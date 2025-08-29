function doPost(e) {
  var sheet = SpreadsheetApp.openById("1OXx6ODkYIpCROlPXQPXww4tTphcqhhVZi-R8kCowlgw").getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.fullName,          
    data.email,              
    data.incidentType,       
    data.incidentDescription 
  ]);

  sendIncidentEmail(timestamp, data);
  
  return ContentService
    .createTextOutput("Success")
    .setMimeType(ContentService.MimeType.TEXT);
}
