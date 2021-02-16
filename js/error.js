function SendErrorMsg (pgName, methodName,errorMessage) {
	var ut = navigator.userAgent;
	var postData = {"pgName":pgName,"methodName":methodName,"errorMessage":errorMessage,"userAgent":ut};
	$.post("https://prod-12.japaneast.logic.azure.com:443/workflows/4a1b48dd6d9d45e7a4997c21abeacdc7/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=64EMXa3MMqVk3YAhWG5ghzsHe-Xna6YJvW0l99xbfOk", postData);
}