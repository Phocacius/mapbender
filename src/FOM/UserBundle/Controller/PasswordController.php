<?php
namespace FOM\UserBundle\Controller;

use FOM\UserBundle\Entity\User;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\FormError;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Password reset controller.
 *
 * Workflow is as follows:
 *   1) GET fom_user_password_form
 *      Form with username / email field for lookup
 *   2) POST fom_user_password_form
 *      Lookup user, set form error if not found or not activated
 *      Set reset token
 *      Send email
 *      Forward to send page
 *   3) GET fom_user_password_send /password/send send.html.twig
 *      Show instructions
 *   4) GET fom_user_password_reset /user/reset?token=...
 *      Lookup token, show error if not found or expired
 *      Show form with password field
 *   5) POST fom_user_password_password /user/reset?token=...
 *      Set new password
 *      Remove reset token
 *      Forward to confirm page
 *   6) GET fom_user_password_done /password/done done.html.twig
 *      Show congratulation page with link to login
 *
 * @author Christian Wygoda
 * @author Paul Schmidt
 */
class PasswordController extends AbstractEmailProcessController
{
    /** @var LoggerInterface */
    protected $logger;
    protected $enableReset;
    protected $maxTokenAge;

    public function __construct(\Swift_Mailer $mailer,
                                LoggerInterface $logger,
                                $userEntityClass,
                                $emailFromName,
                                $emailFromAddress,
                                $enableReset,
                                $maxTokenAge,
                                $isDebug)
    {
        $this->logger = $logger;
        parent::__construct($mailer, $userEntityClass, $emailFromName, $emailFromAddress, $isDebug);
        $this->enableReset = $enableReset;
        $this->maxTokenAge = $maxTokenAge;
        if (!$this->enableReset) {
            $this->debug404("Password reset disabled by configuration");
        }
    }

    /**
     * Password reset step 3: Show instruction page that email has been sent
     *
     * @Route("/user/password/send", methods={"GET"})
     * @return Response
     */
    public function sendAction()
    {
        return $this->render('@FOMUser/Password/send.html.twig');
    }

    /**
     * Password reset steps 1 / 2: Request reset token
     *
     * @Route("/user/password", methods={"GET", "POST"})
     * @param Request $request
     * @return Response
     *
     */
    public function formAction(Request $request)
    {
        $form = $this->createForm('FOM\UserBundle\Form\Type\UserForgotPassType');
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $searchValue = $form->get('search')->getData();
            $userRepository = $this->getUserRepository();
            /** @var User|null $user */
            $user = $userRepository->findOneBy(array(
                'username' => $searchValue,
            ));
            if (!$user) {
                $user = $userRepository->findOneBy(array(
                    'email' => $searchValue,
                ));
            }
            if ($user) {
                $this->setResetToken($user);
                if (!$user->isEnabled()) {
                    $this->logger->warning("Sending password reset link to currently inactive user {$user->getEmail()} ({$user->getUsername()})");
                }
            } else {
                $this->logger->info("NOT sending password reset link to user '{$searchValue}'. No such user exists.");
            }
            return $this->redirectToRoute('fom_user_password_send');
        }

        return $this->render('@FOMUser/Password/form.html.twig', array(
            'form' => $form->createView(),
        ));
    }

    /**
     * Password reset step 4a: Reset the reset token
     *
     * @Route("/user/reset/reset", methods={"POST"})
     * @param Request $request
     * @return Response
     */
    public function tokenResetAction(Request $request)
    {
        $user = $this->getUserFromResetToken($request);
        if (!$user) {
            return $this->render('@FOMUser/Login/error-notoken.html.twig', array(
                'site_email' => $this->emailFromAddress,
            ));
        }

        $this->setResetToken($user);

        return $this->redirectToRoute('fom_user_password_send');
    }

    /**
     * Password reset steps 4 + 5: Show password reset form
     *
     * @Route("/user/reset", methods={"GET", "POST"})
     * @param Request $request
     * @return Response
     */
    public function resetAction(Request $request)
    {
        $user = $this->getUserFromResetToken($request);
        if (!$user) {
            return $this->render('@FOMUser/Login/error-notoken.html.twig', array(
                'site_email' => $this->emailFromAddress,
            ));
        }

        if (!$this->checkTimeInterval($user->getResetTime(), $this->maxTokenAge)) {
            return $this->tokenExpired($user);
        }

        $form = $this->createForm('FOM\UserBundle\Form\Type\UserResetPassType', $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em = $this->getEntityManager();
            $user->setResetToken(null);
            $em->persist($user);
            $em->flush();

            return $this->redirectToRoute('fom_user_password_done');
        }

        return $this->render('@FOMUser/Password/reset.html.twig', array(
            'user' => $user,
            'form' => $form->createView(),
        ));
    }

    /**
     * Password reset step 6: All done message
     *
     * @Route("/user/reset/done", methods={"GET"})
     * @return Response
     */
    public function doneAction()
    {
        return $this->render('@FOMUser/Password/done.html.twig');
    }

    /**
     * @param User $user
     * @throws \Exception
     */
    protected function setResetToken($user)
    {
        $user->setResetToken(hash("sha1", rand()));
        $user->setResetTime(new \DateTime());

        //send email
        $mailFrom = array($this->emailFromAddress => $this->emailFromName);

        $text = $this->renderView('@FOMUser/Password/email-body.text.twig', array("user" => $user));
        $html = $this->renderView('@FOMUser/Password/email-body.html.twig', array("user" => $user));
        $message = new \Swift_Message();
        $message
            ->setSubject($this->renderView('@FOMUser/Password/email-subject.text.twig'))
            ->setFrom($mailFrom)
            ->setTo($user->getEmail())
            ->setBody($text)
            ->addPart($html, 'text/html')
        ;
        $this->mailer->send($message);

        $em = $this->getEntityManager();
        $em->flush();
    }

    /**
     * @param Request $request
     * @return User|null
     */
    protected function getUserFromResetToken(Request $request)
    {
        $token = $request->get('token');
        if ($token) {
            /** @var User|null $user */
            $user = $this->getUserRepository()->findOneBy(array(
                'resetToken' => $token,
            ));
            return $user;
        } else {
            return null;
        }
    }
}
