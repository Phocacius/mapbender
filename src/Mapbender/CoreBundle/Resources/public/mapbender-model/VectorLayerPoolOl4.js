window.Mapbender = Mapbender || {};
window.Mapbender.VectorLayerPoolOl4 = (function() {
    function VectorLayerPoolOl4(olMap) {
        window.Mapbender.VectorLayerPool.apply(this, arguments);
        // use one native layer group to contain all element groups
        this.nativeElementLayerGroup_ = new ol.layer.Group();
        olMap.getLayers().push(this.nativeElementLayerGroup_);
    }
    window.Mapbender.VectorLayerPool.typeMap['ol4'] = VectorLayerPoolOl4;
    VectorLayerPoolOl4.prototype = Object.create(Mapbender.VectorLayerPool.prototype);
    Object.assign(VectorLayerPoolOl4.prototype, {
        constructor: VectorLayerPoolOl4,
        createBridgeLayer_: function(olMap) {
            return new window.Mapbender.VectorLayerBridgeOl4(olMap);
        },
        createOwnerGroup_: function(owner) {
            // use a native layer group to contain all layers owned by the element
            var nativeGroup = new ol.layer.Group();
            this.nativeElementLayerGroup_.getLayers().push(nativeGroup);
            return {
                owner: owner,
                nativeGroup: nativeGroup,
                bridgeLayers: []
            };
        },
        addBridgeLayerToGroup_: function(group, layerBridge) {
            window.Mapbender.VectorLayerPool.prototype.addBridgeLayerToGroup_.call(this, group, layerBridge);
            group.nativeGroup.getLayers().push(layerBridge.getNativeLayer());
        }
    });
}());
