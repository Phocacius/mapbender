!(function() {
    /**
     * @todo: determine if we need to keep this, remove if possible
     *
     * This method is currently only expected by the Openlayers 4-based
     * custom ol.interaction.Transform control, which may be obsolete
     * on Openlayers 6.
     */
    if (window.ol && !ol.inherits) {
        ol.inherits = function(childCtor, parentCtor) {
            childCtor.prototype = Object.create(parentCtor.prototype);
            childCtor.prototype.constructor = childCtor;
        };
    }
}());
