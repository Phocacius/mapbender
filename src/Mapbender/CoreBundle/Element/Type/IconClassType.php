<?php
namespace Mapbender\CoreBundle\Element\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\OptionsResolver\Options;
use Symfony\Component\OptionsResolver\OptionsResolver;

class IconClassType extends AbstractType
{
    public function getParent()
    {
        return 'Symfony\Component\Form\Extension\Core\Type\ChoiceType';
    }

    public function configureOptions(OptionsResolver $resolver)
    {
        $icons = array(

            // Mapbender Icons
            'icon-layer-tree'   => 'Layer tree',
            'icon-feature-info' => 'Feature Info',
            'icon-area-ruler'   => 'Area ruler',
            'icon-polygon'      => 'Polygon',
            'icon-line-ruler'   => 'Line ruler',
            'icon-image-export' => 'Image Export',
            'icon-legend'       => 'Legend',
            'icon-about'        => 'About',

            // FontAwesome
            'iconAbout'         => 'About (FontAwesome)',
            'iconAreaRuler'     => 'Area ruler (FontAwesome)',
            'iconInfoActive'    => 'Feature info (FontAwesome)',
            'iconGps'           => 'GPS (FontAwesome)',
            'iconLegend'        => 'Legend (FontAwesome)',
            'iconPrint'         => 'Print (FontAwesome)',
            'iconSearch'        => 'Search (FontAwesome)',
            'iconLayertree'     => 'Layer tree (FontAwesome)',
            'iconWms'           => 'WMS (FontAwesome)',
            'iconHelp'          => 'Help (FontAwesome)',
            'iconWmcEditor'     => 'WMC Editor (FontAwesome)',
            'iconWmcLoader'     => 'WMC Loader (FontAwesome)',
            'iconCoordinates'   => 'Coordinates (FontAwesome)',
            'iconGpsTarget'     => 'Gps Target (FontAwesome)',
            'iconPoi'           => 'POI (FontAwesome)',
            'iconImageExport'   => 'Image Export (FontAwesome)',
            'iconSketch'        => 'Sketch (FontAwesome)',
            'iconCopyright'     => 'Copyright (FontAwesome)',
        );

        asort($icons);

        $resolver->setDefaults(array(
            'placeholder' => function(Options $options) {
                if ($options['required']) {
                    return 'mb.form.choice_required';
                } else {
                    return 'mb.form.choice_optional';
                }
            },
            'choices' => array_flip($icons),
        ));
    }
}
