/**
 * An Entity that helps using a HTML5 2d canvas as Sprite. Its component temporarily takes over
 * the renderer, so any entity that gets attached to the parent will start drawing on the canvas.
 * <br>Exports: Constructor
 * @param {Object} settings - Required, set the width and height
 * @param {Number} settings.width - Width of the canvas (ignored if settings.canvas is set)
 * @param {Number} settings.height - Height of the canvas (ignored if settings.canvas is set)
 * @param {HTML-Canvas-Element} (settings.canvas) - Reference to an existing canvas object. Optional.
 * @param {Number} settings.preventAutoClear - Stops the canvas from clearing every tick
 * @param {Number} settings.pixelSize - size of a pixel (multiplies canvas size)
 * @module bento/canvas
 * @moduleName Canvas
 * @returns Entity
 */
bento.define('bento/canvas', [
    'bento',
    'bento/math/vector2',
    'bento/math/rectangle',
    'bento/components/sprite',
    'bento/components/clickable',
    'bento/entity',
    'bento/eventsystem',
    'bento/utils',
    'bento/tween',
    'bento/packedimage',
    'bento/objectpool',
    'bento/renderers/canvas2d'
], function (
    Bento,
    Vector2,
    Rectangle,
    Sprite,
    Clickable,
    Entity,
    EventSystem,
    Utils,
    Tween,
    PackedImage,
    ObjectPool,
    Canvas2D
) {
    'use strict';
    var canvasPool = new ObjectPool({
        poolSize: 1,
        constructor: function () {
            var canvas = document.createElement('canvas');

            return canvas;
        },
        destructor: function (obj) {
            // clear canvas
            var context = obj.getContext('2d');
            context.clearRect(0, 0, obj.width, obj.height);
            // clear texture
            if (obj.texture) {
                obj.texture = null;
            }
            return obj;
        }
    });
    return function (settings) {
        var viewport = Bento.getViewport();
        var i;
        var l;
        var sprite;
        var canvas;
        var context;
        var originalRenderer;
        var renderer;
        var packedImage;
        var origin = new Vector2(0, 0);
        var entity;
        var components;
        var drawn = false;
        // this component swaps the renderer with a Canvas2D renderer (see bento/renderers/canvas2d)
        var component = {
            name: 'rendererSwapper',
            draw: function (data) {
                // draw once
                if (drawn) {
                    return;
                }

                // clear up canvas
                if (!settings.preventAutoClear) {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }

                // clear up webgl
                if (canvas.texture) {
                    canvas.texture = null;
                }

                // swap renderer
                originalRenderer = data.renderer;
                data.renderer = renderer;

                // re-apply the origin translation
                data.renderer.save();
                data.renderer.translate(Math.round(origin.x), Math.round(origin.y));
            },
            postDraw: function (data) {
                if (drawn) {
                    return;
                }
                data.renderer.restore();
                // swap back
                data.renderer = originalRenderer;

                // draw once
                if (settings.drawOnce) {
                    drawn = true;
                }
            }
        };

        // init canvas
        if (settings.canvas) {
            canvas = settings.canvas;
        } else {
            canvas = canvasPool.get();
            canvas.width = settings.width;
            canvas.height = settings.height;
        }
        context = canvas.getContext('2d');

        // init renderer
        renderer = new Canvas2D(canvas, {
            pixelSize: settings.pixelSize || 1
        });

        if (settings.origin) {
            origin = settings.origin;
        } else if (settings.originRelative) {
            origin = new Vector2(
                settings.width * settings.originRelative.x,
                settings.height * settings.originRelative.y
            );
        }

        // init sprite
        packedImage = new PackedImage(canvas);
        sprite = new Sprite({
            image: packedImage,
            origin: settings.origin,
            originRelative: settings.originRelative
        });

        // init entity and its components
        // sprite goes before the swapcomponent, otherwise the canvas will never be drawn
        components = [sprite, component];
        // attach any other component in settings
        if (settings.components) {
            for (i = 0, l = settings.components.length; i < l; ++i) {
                components.push(settings.components[i]);
            }
        }
        entity = new Entity({
            z: settings.z,
            name: settings.name || 'canvas',
            position: settings.position,
            components: components,
            family: settings.family,
            init: settings.init
        });

        // public interface
        entity.extend({
            /**
             * Returns the canvas element
             * @function
             * @instance
             * @returns HTML Canvas Element
             * @name getCanvas
             */
            getCanvas: function () {
                return canvas;
            },
            /**
             * Returns the 2d context, to perform manual drawing operations
             * @function
             * @instance
             * @returns HTML Canvas 2d Context
             * @name getContext
             */
            getContext: function () {
                return context;
            },
            /**
             * Get the base64 string of the canvas
             * @function
             * @instance
             * @returns String
             * @name getBase64
             */
            getBase64: function () {
                return canvas.toDataURL();
            },
            /**
             * Download the canvas as png
             * @function
             * @instance
             * @name downloadImage
             */
            downloadImage: function (name) {
                var link = document.createElement("a");
                link.download = name || entity.name;
                link.href = canvas.toDataURL();
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });

        return entity;
    };
});