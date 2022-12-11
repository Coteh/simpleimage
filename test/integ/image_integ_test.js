const chai = require("chai");
const chaiHTTP = require("chai-http");
const { stub } = require("sinon");
const databaseOps = require("../../lib/database-ops");
const usernameUtil = require("../../lib/util/username");
const server = require("../../lib/server");
const { assert } = chai;
const fs = require("fs");
const {
    getServerAgent,
    addImagesForUserFromFile,
    getImageExt,
    MongoMemoryTestClient,
    addImagesForUser,
} = require("./integ_test_utils");
const sharp = require("sharp");
const pixelmatch = require("pixelmatch");
const PNG = require("pngjs").PNG;
const bmp = require("@vingle/bmp-js");
const gifResize = require("@gumlet/gif-resize");

chai.use(chaiHTTP);

// TODO:#119 shut down mongo mem server and remove --exit hopefully

const convertToPNG = (img) => {
    return sharp(img).png().toBuffer();
};

const comparePNGImages = async (img1, img2, threshold) => {
    const png1 = PNG.sync.read(img1);
    const png2 = PNG.sync.read(img2);
    // then compares the images using pixelmatch with a 10% threshold to accommodate for any lossy compression
    const diff = new PNG({ width: png2.width, height: png2.height });
    const mismatchedPixels = pixelmatch(png1.data, png2.data, diff.data, png2.width, png2.height, {
        threshold: threshold,
    });
    // fs.writeFileSync("diff.png", PNG.sync.write(diff));
    return mismatchedPixels < 100;
};

describe("integ", () => {
    describe("images", () => {
        let mongoTestClient = new MongoMemoryTestClient();
        var agent = null;
        var usersCollection = null;
        const TEST_USER = "test-user";

        const placeholderImage = fs.readFileSync("./img/ImageDoesNotExist.png");
        const imagesLookupByExt = new Map();
        const lowResImageLookupByExt = new Map();
        const lowResErrorImgLookupByExt = new Map();

        function fetchImage(imageID, ext, lowRes) {
            const lowResQuery = lowRes ? "?res=low" : "";
            return new Promise((resolve, reject) => {
                agent
                    .get(`/images/${imageID}.${ext}${lowResQuery}`)
                    .then((res) => {
                        if (res.statusCode !== 200) {
                            resolve({
                                statusCode: res.statusCode,
                            });
                            return;
                        }
                        resolve(res.body);
                    })
                    .catch((err) => {
                        reject(err);
                    })
                    .finally(() => {
                        agent.close();
                    });
            });
        }

        it("should return PNG image data if it exists", async () => {
            const img = await fetchImage(imagesLookupByExt.get("png").id, "png");
            assert(img.equals(imagesLookupByExt.get("png").data), "Buffers don't match");
        });

        it("should return JPEG image data if it exists", async () => {
            const img = await fetchImage(imagesLookupByExt.get("jpeg").id, "jpeg");
            assert(img.equals(imagesLookupByExt.get("jpeg").data), "Buffers don't match");
        });

        it("should return GIF image data if it exists", async () => {
            const img = await fetchImage(imagesLookupByExt.get("gif").id, "gif");
            assert(img.equals(imagesLookupByExt.get("gif").data), "Buffers don't match");
        });

        it("should return BMP image data if it exists", async () => {
            const img = await fetchImage(imagesLookupByExt.get("bmp").id, "bmp");
            assert(img.equals(imagesLookupByExt.get("bmp").data), "Buffers don't match");
        });

        it("should return placeholder image indicating that image does not exist if image does not exist", async () => {
            const img = await fetchImage("something", "png");
            assert(img.equals(placeholderImage), "Buffers don't match");
        });

        it("should return placeholder image if 'removed.png' is accessed", async () => {
            const img = await fetchImage("removed", "png");
            assert(img.equals(placeholderImage), "Buffers don't match");
        });

        it("should return placeholder image indicating that image does not exist if no filename was passed in", async () => {
            const img = await fetchImage(undefined, "png");
            assert(img.equals(placeholderImage), "Buffers don't match");
        });

        it("should return low resolution JPEG image data if argument provided", async () => {
            const img = await fetchImage(lowResImageLookupByExt.get("jpeg").id, "jpeg", true);
            // verify file size of the low res image is lower than the source image
            const origImg = lowResImageLookupByExt.get("jpeg").data;
            assert.isBelow(img.length, origImg.length);
            // convert both the source image and the low res image to png then compare pixels using pixelmatch
            const pngOrigImg = await convertToPNG(origImg);
            const pngLowImg = await convertToPNG(img);
            assert(await comparePNGImages(pngOrigImg, pngLowImg, 0.2), "Images don't meet threshold");
        });

        it("should handle error generating low resolution JPEG image", async () => {
            // use garbage data that has been added to mongo and attempt to make it lowres using lowres param
            const img = await fetchImage(lowResErrorImgLookupByExt.get("jpeg").id, "jpeg", true);
            assert(img.equals(lowResErrorImgLookupByExt.get("jpeg").data), "Buffers don't match");
        });

        it("should return low resolution PNG image data if argument provided", async () => {
            const img = await fetchImage(lowResImageLookupByExt.get("png").id, "png", true);
            // verify file size of the low res image is lower than the source image
            const origImg = lowResImageLookupByExt.get("png").data;
            assert.isBelow(img.length, origImg.length);
            // they are already png, compare pixels using pixelmatch
            assert(await comparePNGImages(origImg, img, 0.1), "Images don't meet threshold");
        });

        it("should handle error generating low resolution PNG image", async () => {
            // use garbage data that has been added to mongo and attempt to make it lowres using lowres param
            const img = await fetchImage(lowResErrorImgLookupByExt.get("png").id, "png", true);
            assert(img.equals(lowResErrorImgLookupByExt.get("png").data), "Buffers don't match");
        });

        it("should return low resolution GIF image data if argument provided", async () => {
            const img = await fetchImage(lowResImageLookupByExt.get("gif").id, "gif", true);
            // verify file size of the low res image is lower than the source image
            const origImg = lowResImageLookupByExt.get("gif").data;
            assert.isBelow(img.length, origImg.length);
            // convert both the source image and the low res image to png then compare pixels using pixelmatch
            const origImgShrunk = await sharp(origImg)
                .metadata()
                .then((info) => {
                    const resizeDimensions = Math.round(info.width / 2);
                    return gifResize({ width: resizeDimensions })(origImg);
                });
            const pngOrigImg = await convertToPNG(origImgShrunk);
            const pngLowImg = await convertToPNG(img);
            assert(await comparePNGImages(pngOrigImg, pngLowImg, 0.1), "Images don't meet threshold");
        });

        it("should handle error generating low resolution GIF image", async () => {
            // use garbage data that has been added to mongo and attempt to make it lowres using lowres param
            const img = await fetchImage(lowResErrorImgLookupByExt.get("gif").id, "gif", true);
            assert(img.equals(lowResErrorImgLookupByExt.get("gif").data), "Buffers don't match");
        });

        it("should return low resolution BMP image data if argument provided", async () => {
            const img = await fetchImage(lowResImageLookupByExt.get("bmp").id, "bmp", true);
            // verify file size of the low res image is lower than the source image
            const origImg = lowResImageLookupByExt.get("bmp").data;
            assert.isBelow(img.length, origImg.length);
            // convert both the source image and the low res image to png then compare pixels using pixelmatch
            const bitmap = bmp.decode(origImg, true);
            const pngOrigImg = await sharp(bitmap.data, {
                raw: {
                    width: bitmap.width,
                    height: bitmap.height,
                    channels: 4,
                },
            })
                .toFormat("png")
                .png({ quality: 40 })
                .toBuffer();
            const pngLowImg = await convertToPNG(img);
            assert(await comparePNGImages(pngOrigImg, pngLowImg, 0.1), "Images don't meet threshold");
        });

        it("should handle error generating low resolution BMP image", async () => {
            // use garbage data that has been added to mongo and attempt to make it lowres using lowres param
            const img = await fetchImage(lowResErrorImgLookupByExt.get("bmp").id, "bmp", true);
            assert(img.equals(lowResErrorImgLookupByExt.get("bmp").data), "Buffers don't match");
        });

        it("should handle unsupported image type for low resolution", async () => {
            const tiffImage = await fetchImage(lowResImageLookupByExt.get("tiff").id, "tiff", true);
            const origImg = lowResImageLookupByExt.get("tiff").data;
            assert(tiffImage.equals(origImg), "Buffers don't match");
        });

        it("should return 500 status code if database encountered an error when searching for image", () => {
            const databaseOpsStub = stub(databaseOps, "findImage").callsArgWith(
                1,
                new Error("Error finding image"),
                null
            );
            return fetchImage(imagesLookupByExt.get("png").id, "png")
                .then((res) => {
                    assert.equal(res.statusCode, 500);
                })
                .finally(() => {
                    databaseOpsStub.restore();
                });
        });

        it("should return placeholder image if incorrect extension for image is provided", () => {
            return fetchImage(imagesLookupByExt.get("png").id, "jpeg").then((img) => {
                assert(img.equals(placeholderImage), "Buffers don't match");
            });
        });

        before(async () => {
            await mongoTestClient.initConnection();
            return new Promise(async (resolve) => {
                databaseOps.addUser(
                    {
                        username: "test-user",
                        password: "test",
                        email: "test@test.com",
                    },
                    () => {
                        Promise.all([
                            addImagesForUserFromFile(
                                [
                                    {
                                        fileName: "PNGtest.png",
                                        mimeType: "image/png",
                                    },
                                    {
                                        fileName: "JPEGtest.jpg",
                                        mimeType: "image/jpeg",
                                    },
                                    {
                                        fileName: "BMPtest.bmp",
                                        mimeType: "image/bmp",
                                    },
                                    {
                                        fileName: "GIFtest.gif",
                                        mimeType: "image/gif",
                                    },
                                ],
                                "test-user"
                            ).then((imgs) => {
                                imgs.forEach((imgResult) => {
                                    imagesLookupByExt.set(getImageExt(imgResult.mimetype), imgResult);
                                });
                            }),
                            addImagesForUserFromFile([
                                {
                                    fileName: "Ingranaggio.png",
                                    mimeType: "image/png",
                                },
                                {
                                    fileName: "Ingranaggio.jpg",
                                    mimeType: "image/jpeg",
                                },
                                {
                                    fileName: "Ingranaggio.bmp",
                                    mimeType: "image/bmp",
                                },
                                {
                                    fileName: "Ingranaggio.gif",
                                    mimeType: "image/gif",
                                },
                                // Not actually a tiff image, just mocking tiff mimetype for testing
                                {
                                    fileName: "Ingranaggio.png",
                                    mimeType: "image/tiff",
                                },
                            ]).then((imgs) => {
                                imgs.forEach((imgResult) => {
                                    lowResImageLookupByExt.set(getImageExt(imgResult.mimetype), imgResult);
                                });
                            }),
                            addImagesForUser([
                                {
                                    imageBuffer: Buffer.from("test"),
                                    mimeType: "image/png",
                                },
                                {
                                    imageBuffer: Buffer.from("test"),
                                    mimeType: "image/jpeg",
                                },
                                {
                                    imageBuffer: Buffer.from("test"),
                                    mimeType: "image/bmp",
                                },
                                {
                                    imageBuffer: Buffer.from("test"),
                                    mimeType: "image/gif",
                                },
                            ]).then((imgs) => {
                                imgs.forEach((imgResult) => {
                                    lowResErrorImgLookupByExt.set(getImageExt(imgResult.mimetype), imgResult);
                                });
                            }),
                        ])
                            .then(() => {
                                resolve();
                            })
                            .catch((err) => assert.fail(err));
                    }
                );
            });
        });

        beforeEach((done) => {
            databaseOps.addUser(
                {
                    username: TEST_USER,
                    password: "test",
                    email: "test@test.com",
                },
                () => {
                    agent = getServerAgent();
                    done();
                }
            );
        });

        afterEach(() => {
            usersCollection = mongoTestClient.db.collection("users");
            usersCollection.deleteMany({});
            agent.close();
        });

        after(() => {
            return mongoTestClient.deinitConnection();
        });
    });
});
