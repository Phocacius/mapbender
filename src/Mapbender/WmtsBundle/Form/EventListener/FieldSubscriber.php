<?php

namespace Mapbender\WmtsBundle\Form\EventListener;

use Mapbender\WmtsBundle\Entity\WmtsInstanceLayer;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormInterface;

class FieldSubscriber implements EventSubscriberInterface
{

    /**
     * Returns defined events
     * @return array events
     */
    public static function getSubscribedEvents()
    {
        return array(
            FormEvents::PRE_SET_DATA => 'preSetData',
        );
    }

    public function preSetData(FormEvent $event)
    {
        if ($event->getData()) {
            $this->reconfigureFields($event->getForm(), $event->getData());
        }
    }

    protected function reconfigureFields(FormInterface $form, WmtsInstanceLayer $data)
    {
        $arrStyles = $data->getSourceItem()->getStyles();
        $styleOpt = array("" => "");
        foreach ($arrStyles as $style) {
            $styleOpt[$style->getTitle()] = $style->getIdentifier();
        }
        $form->add('style', 'Symfony\Component\Form\Extension\Core\Type\ChoiceType', array(
            'label' => 'Style',
            'choices' => $styleOpt,
            "required" => false,
            'auto_initialize' => false
        ));
    }
}
