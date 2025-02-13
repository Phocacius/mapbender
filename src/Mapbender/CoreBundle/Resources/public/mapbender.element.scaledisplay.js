(function($) {
    'use strict';

    $.widget("mapbender.mbScaledisplay", {
        options: {
            scalePrefix: null,
            unitPrefix: false
        },
        mbMap: null,

        /**
         * Creates the scale display
         */
        _create: function() {
            var self = this;
            if (typeof this.options.unitPrefix === 'undefined') {
                this.options.unitPrefix = false;
            }
            Mapbender.elementRegistry.waitReady('.mb-element-map').then(function(mbMap) {
                self.mbMap = mbMap;
                self._setup();
            }, function() {
                Mapbender.checkTarget('mbScaledisplay');
            });
        },

        /**
         * Initializes the scale display
         */
        _setup: function() {
            var self = this;
            $(this.mbMap.element).on('mbmapzoomchanged', function(e, data) {
                self._updateDisplay(data.scaleExact);
            });
            $(this.mbMap.element).on('mbmapsrschanged', function() {
                self._autoUpdate();
            });
            this._autoUpdate();
            this._trigger('ready');
        },
        _updateDisplay: function(scale) {
            if (!scale) {
                return;
            }
            var scaleText;

            if(this.options.unitPrefix){
                if (scale >= 9500 && scale <= 950000) {
                    scaleText = Math.round(scale / 1000) + "K";
                } else if (scale >= 950000) {
                    scaleText = Math.round(scale / 1000000) + "M";
                } else {
                    scaleText = Math.round(scale);
                }
            } else{
                scaleText = Math.round(scale).toString();
            }
            var parts = ["1 : ", scaleText];
            if (this.options.scalePrefix) {
                parts.unshift(this.options.scalePrefix, ' ');
            }
            $(this.element).text(parts.join(''));
        },
        _autoUpdate: function() {
            this._updateDisplay(this.mbMap.getModel().getCurrentScale(false));
        }
    });

})(jQuery);
