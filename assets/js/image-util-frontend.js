import EXIF from "exif-js";

window.getTranslationValue = function(orientation) {
    var ua = $("#upload-area");
    var ip = $(".image-preview");
    var uploadAreaPos = ua.position().top + ua.height() / 2;
    var imagePreviewPos = ip.position().top + ip.height();
    var translation = uploadAreaPos - imagePreviewPos;
    if (orientation >= 7) {
        return -translation;
    } else {
        return translation;
    }
};

window.autoRotateImage = function(img) {
    EXIF.getData(img, function () {
        var orientation = EXIF.getTag(this, "Orientation");
        var cssTransformations = {
            rotate: "",
            scale: "",
            translate: ""
        };

        switch (orientation) {
            case 1: // do nothing
                break;
            case 2:
                cssTransformations.scale = "scaleX(-1)";
                break;
            case 3:
                cssTransformations.scale = "scale(-1)";
                break;
            case 4:
                cssTransformations.scale = "scaleY(-1)";
                break;
            case 5:
                cssTransformations.rotate = "rotate(-270deg)";
                cssTransformations.scale = "scaleY(-1)";
                break;
            case 6:
                cssTransformations.rotate = "rotate(90deg)";
                break;
            case 7:
                cssTransformations.rotate = "rotate(90deg)";
                cssTransformations.scale = "scaleX(-1)";
                break;
            case 8:
                cssTransformations.rotate = "rotate(-90deg)";
                break;
        }

        var cssTransformationString = cssTransformations.rotate + " " + cssTransformations.scale;
        img.style.transform = cssTransformationString;
        // Get the translation value after rotating image
        cssTransformations.translate = "translate" + ((orientation >= 5) ? "X" : "Y") + "(" + getTranslationValue(orientation) + "px)";
        img.style.transform = cssTransformationString + " " + cssTransformations.translate;
    });
}