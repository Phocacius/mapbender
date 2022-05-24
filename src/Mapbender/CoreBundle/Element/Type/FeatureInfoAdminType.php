<?php
namespace Mapbender\CoreBundle\Element\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;

class FeatureInfoAdminType extends AbstractType
{
    /**
     * @inheritdoc
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add('displayType', 'Symfony\Component\Form\Extension\Core\Type\ChoiceType', array(
                'required' => true,
                'choices' => array(
                    'Tabs' => 'tabs',
                    'Accordion' => 'accordion',
                ),
            ))
            ->add('autoActivate', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
                'label' => 'mb.core.admin.featureinfo.label.autoopen',
            ))
            ->add('printResult', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array('required' => false))
            ->add('deactivateOnClose', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
                'label' => 'mb.core.admin.featureinfo.label.deactivateonclose',
            ))
            ->add('onlyValid', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
                'label' => 'mb.core.admin.featureinfo.label.onlyvalid',
            ))
            ->add('width', 'Symfony\Component\Form\Extension\Core\Type\IntegerType', array(
                'required' => true,
            ))
            ->add('height', 'Symfony\Component\Form\Extension\Core\Type\IntegerType', array(
                'required' => true,
            ))
            ->add('maxCount', 'Symfony\Component\Form\Extension\Core\Type\IntegerType', array(
                'required' => false,
                'attr' => array(
                    'placeholder' => 100,
                ),
            ))
            ->add('highlighting', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
                'label' => 'mb.core.admin.featureinfo.label.highlighting',
            ))
            ->add('featureColorDefault', 'Symfony\Component\Form\Extension\Core\Type\TextType', array(
                'required' => true,
                'label' => 'mb.core.admin.featureinfo.label.featureColorDefault',
            ))
            ->add('featureColorHover', 'Symfony\Component\Form\Extension\Core\Type\TextType', array(
                'required' => true,
                'label' => 'mb.core.admin.featureinfo.label.featureColorHover',
            ))
        ;
    }
}
