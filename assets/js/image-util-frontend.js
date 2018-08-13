import EXIF from "exif-js";

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
                cssTransformations = {
                    rotate: "rotate(-270deg)",
                    scale: "scaleY(-1)",
                    translate: "translateX(25%)"
                }
                break;
            case 6:
                cssTransformations.rotate = "rotate(90deg)";
                cssTransformations.translate = "translateX(25%)";
                break;
            case 7:
                cssTransformations = {
                    rotate: "rotate(90deg)",
                    scale: "scaleX(-1)",
                    translate: "translateX(-25%)"
                }
                break;
            case 8:
                cssTransformations.rotate = "rotate(-90deg)";
                cssTransformations.translate = "translateX(-25%)";
                break;
        }

        var cssTransformationString = cssTransformations.rotate + " " + cssTransformations.scale + " " + cssTransformations.translate;
        img.style.transform = cssTransformationString;
    });
}